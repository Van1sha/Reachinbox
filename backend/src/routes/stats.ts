import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Campaign } from '../models/Campaign';
import { EmailJob } from '../models/EmailJob';
import { requireAuth } from '../middleware/auth';
import { rateLimiter } from '../services/RateLimiter';
import { emailQueue } from '../queues/emailQueue';
import { AppDataSource as DS } from '../config/database';

const router = Router();

// GET /api/stats — Dashboard stats
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const campaignRepo = DS.getRepository(Campaign);
    const jobRepo = DS.getRepository(EmailJob);

    const [totalCampaigns, scheduledCampaigns, completedCampaigns] = await Promise.all([
      campaignRepo.count(),
      campaignRepo.count({ where: { status: 'scheduled' } }),
      campaignRepo.count({ where: { status: 'completed' } }),
    ]);

    const [totalJobs, sentJobs, failedJobs, scheduledJobs] = await Promise.all([
      jobRepo.count(),
      jobRepo.count({ where: { status: 'sent' } }),
      jobRepo.count({ where: { status: 'failed' } }),
      jobRepo.count({ where: { status: 'scheduled' } }),
    ]);

    // BullMQ queue stats
    const [waiting, active, delayed, failed] = await Promise.all([
      emailQueue.getWaitingCount(),
      emailQueue.getActiveCount(),
      emailQueue.getDelayedCount(),
      emailQueue.getFailedCount(),
    ]);

    res.json({
      campaigns: {
        total: totalCampaigns,
        scheduled: scheduledCampaigns,
        completed: completedCampaigns,
      },
      emails: {
        total: totalJobs,
        sent: sentJobs,
        failed: failedJobs,
        scheduled: scheduledJobs,
      },
      queue: {
        waiting,
        active,
        delayed,
        failed,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
