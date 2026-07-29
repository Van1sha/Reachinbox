import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis';

export interface EmailJobData {
  jobId: string;
  campaignId: string;
  recipientEmail: string;
  senderId: string;
  subject: string;
  body: string;
  hourlyLimit: number;
}

export const emailQueue = new Queue<EmailJobData>('email-sends', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '5'),
    backoff: {
      type: 'custom',
    },
    removeOnComplete: { count: 1000, age: 7 * 24 * 3600 },
    removeOnFail: false,
  },
});
