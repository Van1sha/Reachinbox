import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AppDataSource } from '../config/database';
import { Campaign } from '../models/Campaign';
import { adaptiveScheduler } from '../services/AdaptiveScheduler';
import { requireAuth } from '../middleware/auth';

const router = Router();

const ScheduleCampaignSchema = z.object({
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  recipients: z.array(z.string().email()).min(1).max(10000),
  senderId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  hourlyLimit: z.number().int().min(1).max(1000).default(100),
  delayBetweenEmailsMs: z.number().int().min(1000).default(2000),
});

const PreviewSchema = z.object({
  senderId: z.string().uuid(),
  hourlyLimit: z.number().int().min(1).max(1000),
  totalEmails: z.number().int().min(1),
  startTime: z.string().datetime(),
  delayBetweenEmailsMs: z.number().int().min(1000),
});

// GET /api/campaigns
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const campaignRepo = AppDataSource.getRepository(Campaign);
    const { status, createdBy, page = '1', limit = '20' } = req.query;

    const qb = campaignRepo
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.sender', 'sender')
      .orderBy('campaign.createdAt', 'DESC')
      .skip((parseInt(String(page)) - 1) * parseInt(String(limit)))
      .take(parseInt(String(limit)));

    if (status) qb.andWhere('campaign.status = :status', { status });
    if (createdBy) qb.andWhere('campaign.createdBy = :createdBy', { createdBy });

    const [campaigns, total] = await qb.getManyAndCount();

    res.json({
      campaigns,
      pagination: {
        page: parseInt(String(page)),
        limit: parseInt(String(limit)),
        total,
        pages: Math.ceil(total / parseInt(String(limit))),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/campaigns/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const campaignRepo = AppDataSource.getRepository(Campaign);
    const campaign = await campaignRepo.findOne({
      where: { id: req.params.id },
      relations: ['sender'],
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ campaign });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/campaigns/preview — Preview adaptive schedule before submitting
router.post('/preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = PreviewSchema.parse(req.body);
    const plan = await adaptiveScheduler.previewPlan({
      senderId: data.senderId,
      hourlyLimit: data.hourlyLimit,
      totalEmails: data.totalEmails,
      startTime: new Date(data.startTime),
      delayBetweenEmailsMs: data.delayBetweenEmailsMs,
    });
    res.json({ plan });
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// POST /api/campaigns — Schedule a new campaign
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = ScheduleCampaignSchema.parse(req.body);
    const user = req.user as any;

    const campaign = await adaptiveScheduler.schedule({
      subject: data.subject,
      body: data.body,
      recipients: data.recipients,
      senderId: data.senderId,
      scheduledAt: new Date(data.scheduledAt),
      hourlyLimit: data.hourlyLimit,
      delayBetweenEmailsMs: data.delayBetweenEmailsMs,
      createdBy: user?.email || 'unknown',
    });

    res.status(201).json({ campaign });
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

export default router;
