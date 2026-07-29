import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { EmailJob } from '../models/EmailJob';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/jobs?campaignId=&status=&page=&limit=
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const jobRepo = AppDataSource.getRepository(EmailJob);
    const { campaignId, status, page = '1', limit = '50' } = req.query;

    const qb = jobRepo
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.campaign', 'campaign')
      .orderBy('job.estimatedSendTime', 'ASC')
      .skip((parseInt(String(page)) - 1) * parseInt(String(limit)))
      .take(parseInt(String(limit)));

    if (campaignId) qb.andWhere('campaign.id = :campaignId', { campaignId });
    if (status) qb.andWhere('job.status = :status', { status });

    const [jobs, total] = await qb.getManyAndCount();

    res.json({
      jobs,
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

// GET /api/jobs/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const jobRepo = AppDataSource.getRepository(EmailJob);
    const job = await jobRepo.findOne({
      where: { id: req.params.id },
      relations: ['campaign', 'campaign.sender'],
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ job });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
