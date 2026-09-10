"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWorker = startWorker;
const bullmq_1 = require("bullmq");
const database_1 = require("../config/database");
const EmailJob_1 = require("../models/EmailJob");
const Campaign_1 = require("../models/Campaign");
const Sender_1 = require("../models/Sender");
const emailQueue_1 = require("../queues/emailQueue");
const EmailSender_1 = require("../services/EmailSender");
const RateLimiter_1 = require("../services/RateLimiter");
const SseEmitter_1 = require("../services/SseEmitter");
const redis_1 = require("../config/redis");
/**
 * Computes exponential backoff with jitter for retries.
 * delay = min(base * 2^attempt, maxDelay) + random(0, jitter)
 */
function computeRetryDelay(attempt) {
    const base = parseInt(process.env.BASE_RETRY_DELAY_MS || '30000');
    const max = parseInt(process.env.MAX_RETRY_DELAY_MS || '1800000');
    const jitter = parseInt(process.env.JITTER_MS || '10000');
    const exponential = Math.min(base * Math.pow(2, attempt), max);
    const randomJitter = Math.random() * jitter;
    return Math.floor(exponential + randomJitter);
}
async function processEmailJob(job) {
    const { campaignId, recipientEmail, senderId, subject, body, hourlyLimit } = job.data;
    const bullJobId = job.id;
    const jobRepo = database_1.AppDataSource.getRepository(EmailJob_1.EmailJob);
    const campaignRepo = database_1.AppDataSource.getRepository(Campaign_1.Campaign);
    const senderRepo = database_1.AppDataSource.getRepository(Sender_1.Sender);
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
    const lockAcquired = await redis_1.redisClient.set(lockKey, '1', 'EX', 30, 'NX');
    if (!lockAcquired) {
        console.log(`🔒 Job ${bullJobId} locked by another worker, skipping`);
        return;
    }
    try {
        // Update status to 'sending'
        if (emailJob) {
            emailJob.status = 'sending';
            await jobRepo.save(emailJob);
            SseEmitter_1.sseEmitter.emit('job:sending', { jobId: emailJob.id, campaignId, recipientEmail, status: 'sending' });
        }
        // Check rate limit atomically (Redis-backed)
        const now = new Date();
        const rateCheck = await RateLimiter_1.rateLimiter.checkAndIncrement(senderId, hourlyLimit, now);
        if (!rateCheck.allowed) {
            // Rate limit exceeded — reschedule to next hour
            const nextHour = RateLimiter_1.rateLimiter.getNextHourStart(now);
            const delayMs = nextHour.getTime() - now.getTime();
            console.log(`⏳ Rate limit reached for sender ${senderId}. ` +
                `Rescheduling ${recipientEmail} to ${nextHour.toISOString()}`);
            if (emailJob) {
                emailJob.status = 'scheduled';
                emailJob.estimatedSendTime = nextHour;
                emailJob.errorMessage = `Rate limit reached (${rateCheck.currentCount}/${rateCheck.limit}). Rescheduled.`;
                await jobRepo.save(emailJob);
                SseEmitter_1.sseEmitter.emit('job:rescheduled', {
                    jobId: emailJob.id,
                    campaignId,
                    recipientEmail,
                    status: 'scheduled',
                    newEstimatedTime: nextHour,
                    reason: 'rate_limit',
                });
            }
            // Move job back into queue with delay (preserving order)
            await emailQueue_1.emailQueue.add('send-email', job.data, {
                jobId: `${bullJobId}:r${job.attemptsMade + 1}`,
                delay: delayMs,
                attempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '5'),
                backoff: { type: 'custom' },
                removeOnComplete: { count: 1000 },
                removeOnFail: false,
            });
            return; // Mark current job as complete (the rescheduled one will handle it)
        }
        // Fetch sender
        let sender = await senderRepo.findOne({ where: { id: senderId } });
        if (!sender)
            throw new bullmq_1.UnrecoverableError(`Sender ${senderId} not found`);
        // If this sender is an old Ethereal test sender, upgrade it to an active real sender
        if (sender.smtpHost?.includes('ethereal')) {
            const activeSender = await senderRepo
                .createQueryBuilder('s')
                .where("s.smtp_host NOT LIKE '%ethereal%' AND s.smtp_pass IS NOT NULL AND s.smtp_pass != ''")
                .getOne();
            if (activeSender) {
                sender = activeSender;
            }
            else if (process.env.BREVO_API_KEY) {
                sender.smtpHost = 'smtp-relay.brevo.com';
                sender.smtpPass = process.env.BREVO_API_KEY;
                sender.smtpPort = 465;
                sender.smtpSecure = true;
            }
            else if (process.env.SMTP_PASS) {
                sender.smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
                sender.smtpPort = parseInt(process.env.SMTP_PORT || '465');
                sender.smtpSecure = process.env.SMTP_SECURE !== 'false';
                sender.smtpUser = process.env.SMTP_USER || sender.email;
                sender.smtpPass = process.env.SMTP_PASS;
            }
        }
        // Send email via Ethereal SMTP
        const result = await (0, EmailSender_1.sendEmail)({
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
            .update(Campaign_1.Campaign)
            .set({ sentCount: () => '"sent_count" + 1' })
            .where('id = :id', { id: campaignId })
            .execute();
        // Check if campaign is fully completed
        const campaign = await campaignRepo.findOne({ where: { id: campaignId } });
        if (campaign && campaign.sentCount + campaign.failedCount >= campaign.totalRecipients) {
            campaign.status = 'completed';
            await campaignRepo.save(campaign);
            SseEmitter_1.sseEmitter.emit('campaign:completed', { campaignId });
        }
        else if (campaign?.status === 'scheduled') {
            campaign.status = 'in_progress';
            await campaignRepo.save(campaign);
        }
        // Emit SSE
        SseEmitter_1.sseEmitter.emit('job:sent', {
            jobId: emailJob?.id,
            campaignId,
            recipientEmail,
            status: 'sent',
            sentAt: new Date().toISOString(),
            previewUrl: result.previewUrl,
        });
        console.log(`✉️  Sent to ${recipientEmail} — messageId: ${result.messageId}`);
    }
    finally {
        // Release lock
        await redis_1.redisClient.del(lockKey);
    }
}
function startWorker() {
    const worker = new bullmq_1.Worker('email-sends', processEmailJob, {
        connection: (0, redis_1.createRedisConnection)(),
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
        limiter: {
            // Enforce minimum delay between individual sends
            max: parseInt(process.env.MAX_JOBS_PER_DURATION || '2'),
            duration: parseInt(process.env.LIMITER_DURATION_MS || '2000'),
        },
        settings: {
            backoffStrategy: (attemptsMade) => computeRetryDelay(attemptsMade),
        },
    });
    // Custom backoff strategy (exponential + jitter)
    worker.on('failed', async (job, err) => {
        if (!job)
            return;
        const { campaignId, recipientEmail, senderId } = job.data;
        const attempt = job.attemptsMade;
        const delay = computeRetryDelay(attempt);
        console.error(`❌ Job failed (attempt ${attempt}): ${recipientEmail} — ${err.message}. ` +
            `Retrying in ${Math.round(delay / 1000)}s`);
        const jobRepo = database_1.AppDataSource.getRepository(EmailJob_1.EmailJob);
        const emailJob = await jobRepo.findOne({ where: { bullJobId: job.id } });
        if (emailJob) {
            emailJob.status = 'retrying';
            emailJob.retryCount = attempt;
            emailJob.nextRetryAt = new Date(Date.now() + delay);
            emailJob.errorMessage = err.message;
            await jobRepo.save(emailJob);
            SseEmitter_1.sseEmitter.emit('job:retrying', {
                jobId: emailJob.id,
                campaignId,
                recipientEmail,
                status: 'retrying',
                retryCount: attempt,
                nextRetryAt: emailJob.nextRetryAt,
                delayMs: delay,
            });
        }
        // Update campaign failed count if max attempts exceeded
        if (job.attemptsMade >= parseInt(process.env.MAX_RETRY_ATTEMPTS || '5') - 1) {
            const jobRepo2 = database_1.AppDataSource.getRepository(EmailJob_1.EmailJob);
            const failedJob = await jobRepo2.findOne({ where: { bullJobId: job.id } });
            if (failedJob) {
                failedJob.status = 'failed';
                await jobRepo2.save(failedJob);
            }
            const campaignRepo = database_1.AppDataSource.getRepository(Campaign_1.Campaign);
            await campaignRepo
                .createQueryBuilder()
                .update(Campaign_1.Campaign)
                .set({ failedCount: () => '"failed_count" + 1' })
                .where('id = :id', { id: campaignId })
                .execute();
            SseEmitter_1.sseEmitter.emit('job:failed', {
                jobId: emailJob?.id,
                campaignId,
                recipientEmail,
                status: 'failed',
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
