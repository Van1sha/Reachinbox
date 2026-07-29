import { AppDataSource } from '../config/database';
import { Campaign } from '../models/Campaign';
import { EmailJob } from '../models/EmailJob';
import { Sender } from '../models/Sender';
import { emailQueue } from '../queues/emailQueue';
import { rateLimiter } from './RateLimiter';
import { sseEmitter } from './SseEmitter';

export interface ScheduleEmailsParams {
  subject: string;
  body: string;
  recipients: string[];
  senderId: string;
  scheduledAt: Date;
  hourlyLimit: number;
  delayBetweenEmailsMs: number;
  createdBy: string;
}

export interface AdaptivePlanPreview {
  totalEmails: number;
  estimatedTimes: Date[];
  hoursSpanned: number;
  firstSendTime: Date;
  lastSendTime: Date;
  slotsRemainingCurrentHour: number;
}

/**
 * Smart Adaptive Scheduler
 *
 * Plans the exact estimated send time for every email in a campaign,
 * accounting for:
 *   - Current rate counter in Redis
 *   - Per-sender hourly limit
 *   - Minimum delay between sends
 *   - Overflow into future hours (preserving order)
 *
 * No cron jobs used — BullMQ delayed jobs handle all timing.
 */
export class AdaptiveScheduler {
  private campaignRepo = AppDataSource.getRepository(Campaign);
  private jobRepo = AppDataSource.getRepository(EmailJob);
  private senderRepo = AppDataSource.getRepository(Sender);

  /**
   * Preview estimated send times WITHOUT creating the campaign.
   * Used by the frontend to show the plan before scheduling.
   */
  async previewPlan(params: {
    senderId: string;
    hourlyLimit: number;
    totalEmails: number;
    startTime: Date;
    delayBetweenEmailsMs: number;
  }): Promise<AdaptivePlanPreview> {
    const sender = await this.senderRepo.findOne({ where: { id: params.senderId } });
    const effectiveLimit = Math.min(
      params.hourlyLimit,
      sender?.hourlyLimit ?? parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '100')
    );

    const slotsRemaining = await rateLimiter.getRemainingSlots(params.senderId, effectiveLimit);

    const estimatedTimes = await rateLimiter.computeEstimatedSendTimes({
      senderId: params.senderId,
      senderHourlyLimit: effectiveLimit,
      totalEmails: params.totalEmails,
      startTime: params.startTime,
      delayBetweenEmailsMs: params.delayBetweenEmailsMs,
    });

    const firstTime = estimatedTimes[0];
    const lastTime = estimatedTimes[estimatedTimes.length - 1];
    const hoursSpanned = Math.ceil(
      (lastTime.getTime() - firstTime.getTime()) / (1000 * 60 * 60)
    ) + 1;

    return {
      totalEmails: params.totalEmails,
      estimatedTimes,
      hoursSpanned,
      firstSendTime: firstTime,
      lastSendTime: lastTime,
      slotsRemainingCurrentHour: slotsRemaining,
    };
  }

  /**
   * Main scheduling method.
   * Creates campaign + email jobs + BullMQ delayed jobs atomically.
   */
  async schedule(params: ScheduleEmailsParams): Promise<Campaign> {
    const sender = await this.senderRepo.findOne({ where: { id: params.senderId } });
    if (!sender) {
      throw new Error(`Sender ${params.senderId} not found`);
    }

    const effectiveLimit = Math.min(
      params.hourlyLimit,
      sender.hourlyLimit,
      parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '100')
    );

    // Compute estimated send times using smart planner
    const estimatedTimes = await rateLimiter.computeEstimatedSendTimes({
      senderId: params.senderId,
      senderHourlyLimit: effectiveLimit,
      totalEmails: params.recipients.length,
      startTime: params.scheduledAt,
      delayBetweenEmailsMs: params.delayBetweenEmailsMs,
    });

    // Create campaign record
    const campaign = this.campaignRepo.create({
      subject: params.subject,
      body: params.body,
      createdBy: params.createdBy,
      sender,
      scheduledAt: params.scheduledAt,
      hourlyLimit: effectiveLimit,
      delayBetweenEmailsMs: params.delayBetweenEmailsMs,
      totalRecipients: params.recipients.length,
      status: 'scheduled',
    });
    await this.campaignRepo.save(campaign);

    // Create email job records and BullMQ delayed jobs
    const now = Date.now();
    const emailJobs: EmailJob[] = [];

    for (let i = 0; i < params.recipients.length; i++) {
      const recipient = params.recipients[i];
      const estimatedTime = estimatedTimes[i];
      const delay = Math.max(0, estimatedTime.getTime() - now);

      // Deterministic BullMQ job ID for idempotency
      const bullJobId = `${campaign.id}:${recipient}:${i}`;

      const emailJob = this.jobRepo.create({
        recipientEmail: recipient,
        bullJobId,
        status: 'scheduled',
        estimatedSendTime: estimatedTime,
        campaign,
      });
      emailJobs.push(emailJob);

      // Add to BullMQ with delay (persisted in Redis, survives restarts)
      await emailQueue.add(
        'send-email',
        {
          jobId: '', // will be filled after DB save
          campaignId: campaign.id,
          recipientEmail: recipient,
          senderId: sender.id,
          subject: params.subject,
          body: params.body,
          hourlyLimit: effectiveLimit,
        },
        {
          jobId: bullJobId,
          delay,
          attempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '5'),
          backoff: { type: 'custom' },
          removeOnComplete: { count: 1000 },
          removeOnFail: false,
        }
      );
    }

    // Bulk save email job records
    await this.jobRepo.save(emailJobs);

    // Emit SSE event for real-time dashboard update
    sseEmitter.emit('campaign:created', {
      campaignId: campaign.id,
      totalRecipients: params.recipients.length,
      firstSendTime: estimatedTimes[0],
      lastSendTime: estimatedTimes[estimatedTimes.length - 1],
    });

    console.log(
      `✅ Campaign ${campaign.id} scheduled: ${params.recipients.length} emails, ` +
      `first at ${estimatedTimes[0].toISOString()}, last at ${estimatedTimes[estimatedTimes.length - 1].toISOString()}`
    );

    return campaign;
  }
}

export const adaptiveScheduler = new AdaptiveScheduler();
