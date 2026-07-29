import { Worker, Job, UnrecoverableError } from 'bullmq';
import { AppDataSource } from '../config/database';
import { EmailJob } from '../models/EmailJob';
import { Campaign } from '../models/Campaign';
import { Sender } from '../models/Sender';
import { emailQueue, EmailJobData } from '../queues/emailQueue';
import { sendEmail } from '../services/EmailSender';
import { rateLimiter } from '../services/RateLimiter';
import { sseEmitter } from '../services/SseEmitter';
import { createRedisConnection, redisClient } from '../config/redis';

/**
 * Computes exponential backoff with jitter for retries.
 * delay = min(base * 2^attempt, maxDelay) + random(0, jitter)
 */
function computeRetryDelay(attempt: number): number {
  const base = parseInt(process.env.BASE_RETRY_DELAY_MS || '30000');
  const max = parseInt(process.env.MAX_RETRY_DELAY_MS || '1800000');
  const jitter = parseInt(process.env.JITTER_MS || '10000');

  const exponential = Math.min(base * Math.pow(2, attempt), max);
  const randomJitter = Math.random() * jitter;
  return Math.floor(exponential + randomJitter);
}

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { campaignId, recipientEmail, senderId, subject, body, hourlyLimit } = job.data;
  const bullJobId = job.id!;

  const jobRepo = AppDataSource.getRepository(EmailJob);
  const campaignRepo = AppDataSource.getRepository(Campaign);
  const senderRepo = AppDataSource.getRepository(Sender);

  // Find the DB record for this job
  const emailJob = await jobRepo.findOne({
    where: { bullJobId },
    relations: ['campaign'],
  });

  // Idempotency guard: if already sent, skip
  if (emailJob?.status === 'sent') {
    console.log(`⏭ Job ${bullJobId} already sent, skipping`);
    return;
  }

  // Acquire distributed lock to prevent duplicate sends
  const lockKey = `lock:job:${bullJobId}`;
  const lockAcquired = await redisClient.set(lockKey, '1', 'EX', 30, 'NX');
  if (!lockAcquired) {
    console.log(`🔒 Job ${bullJobId} locked by another worker, skipping`);
    return;
  }

  try {
    // Update status to 'sending'
    if (emailJob) {
      emailJob.status = 'sending';
      await jobRepo.save(emailJob);
      sseEmitter.emit('job:sending', { jobId: emailJob.id, campaignId, recipientEmail });
    }

    // Check rate limit atomically (Redis-backed)
    const now = new Date();
    const rateCheck = await rateLimiter.checkAndIncrement(senderId, hourlyLimit, now);

    if (!rateCheck.allowed) {
      // Rate limit exceeded — reschedule to next hour
      const nextHour = rateLimiter.getNextHourStart(now);
      const delayMs = nextHour.getTime() - now.getTime();

      console.log(
        `⏳ Rate limit reached for sender ${senderId}. ` +
        `Rescheduling ${recipientEmail} to ${nextHour.toISOString()}`
      );

      if (emailJob) {
        emailJob.status = 'scheduled';
        emailJob.estimatedSendTime = nextHour;
        emailJob.errorMessage = `Rate limit reached (${rateCheck.currentCount}/${rateCheck.limit}). Rescheduled.`;
        await jobRepo.save(emailJob);

        sseEmitter.emit('job:rescheduled', {
          jobId: emailJob.id,
          campaignId,
          recipientEmail,
          newEstimatedTime: nextHour,
          reason: 'rate_limit',
        });
      }

      // Move job back into queue with delay (preserving order)
      await emailQueue.add(
        'send-email',
        job.data,
        {
          jobId: `${bullJobId}:r${job.attemptsMade + 1}`,
          delay: delayMs,
          attempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '5'),
          backoff: { type: 'custom' },
          removeOnComplete: { count: 1000 },
          removeOnFail: false,
        }
      );
      return; // Mark current job as complete (the rescheduled one will handle it)
    }

    // Fetch sender
    const sender = await senderRepo.findOne({ where: { id: senderId } });
    if (!sender) throw new UnrecoverableError(`Sender ${senderId} not found`);

    // Send email via Ethereal SMTP
    const result = await sendEmail({
      sender,
      to: recipientEmail,
      subject,
      html: body,
    });

    // Update job status to sent
    if (emailJob) {
      emailJob.status = 'sent';
      emailJob.actualSentTime = new Date();
      emailJob.messageId = result.messageId;
      emailJob.previewUrl = result.previewUrl ? String(result.previewUrl) : null;
      emailJob.errorMessage = null;
      await jobRepo.save(emailJob);
    }

    // Update campaign sent count
    await campaignRepo
      .createQueryBuilder()
      .update(Campaign)
      .set({ sentCount: () => '"sent_count" + 1' })
      .where('id = :id', { id: campaignId })
      .execute();

    // Check if campaign is fully completed
    const campaign = await campaignRepo.findOne({ where: { id: campaignId } });
    if (campaign && campaign.sentCount + campaign.failedCount >= campaign.totalRecipients) {
      campaign.status = 'completed';
      await campaignRepo.save(campaign);
      sseEmitter.emit('campaign:completed', { campaignId });
    } else if (campaign?.status === 'scheduled') {
      campaign.status = 'in_progress';
      await campaignRepo.save(campaign);
    }

    // Emit SSE
    sseEmitter.emit('job:sent', {
      jobId: emailJob?.id,
      campaignId,
      recipientEmail,
      sentAt: new Date().toISOString(),
      previewUrl: result.previewUrl,
    });

    console.log(`✉️  Sent to ${recipientEmail} — messageId: ${result.messageId}`);

  } finally {
    // Release lock
    await redisClient.del(lockKey);
  }
}

export function startWorker() {
  const worker = new Worker<EmailJobData>(
    'email-sends',
    processEmailJob,
    {
      connection: createRedisConnection(),
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
      limiter: {
        // Enforce minimum delay between individual sends
        max: parseInt(process.env.MAX_JOBS_PER_DURATION || '2'),
        duration: parseInt(process.env.LIMITER_DURATION_MS || '2000'),
      },
      settings: {
        backoffStrategy: (attemptsMade: number) => computeRetryDelay(attemptsMade),
      },
    }
  );

  // Custom backoff strategy (exponential + jitter)
  worker.on('failed', async (job, err) => {
    if (!job) return;

    const { campaignId, recipientEmail, senderId } = job.data;
    const attempt = job.attemptsMade;
    const delay = computeRetryDelay(attempt);

    console.error(
      `❌ Job failed (attempt ${attempt}): ${recipientEmail} — ${err.message}. ` +
      `Retrying in ${Math.round(delay / 1000)}s`
    );

    const jobRepo = AppDataSource.getRepository(EmailJob);
    const emailJob = await jobRepo.findOne({ where: { bullJobId: job.id! } });
    if (emailJob) {
      emailJob.status = 'retrying';
      emailJob.retryCount = attempt;
      emailJob.nextRetryAt = new Date(Date.now() + delay);
      emailJob.errorMessage = err.message;
      await jobRepo.save(emailJob);

      sseEmitter.emit('job:retrying', {
        jobId: emailJob.id,
        campaignId,
        recipientEmail,
        retryCount: attempt,
        nextRetryAt: emailJob.nextRetryAt,
        delayMs: delay,
      });
    }

    // Update campaign failed count if max attempts exceeded
    if (job.attemptsMade >= parseInt(process.env.MAX_RETRY_ATTEMPTS || '5') - 1) {
      const jobRepo2 = AppDataSource.getRepository(EmailJob);
      const failedJob = await jobRepo2.findOne({ where: { bullJobId: job.id! } });
      if (failedJob) {
        failedJob.status = 'failed';
        await jobRepo2.save(failedJob);
      }

      const campaignRepo = AppDataSource.getRepository(Campaign);
      await campaignRepo
        .createQueryBuilder()
        .update(Campaign)
        .set({ failedCount: () => '"failed_count" + 1' })
        .where('id = :id', { id: campaignId })
        .execute();

      sseEmitter.emit('job:failed', {
        jobId: emailJob?.id,
        campaignId,
        recipientEmail,
        error: err.message,
      });
    }
  });

  // backoffStrategy is set in worker constructor options above

  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed`);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  return worker;
}
