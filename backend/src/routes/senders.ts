import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AppDataSource } from '../config/database';
import { Sender } from '../models/Sender';
import { createEtherealAccount } from '../services/EmailSender';
import { requireAuth } from '../middleware/auth';

const router = Router();

const CreateSenderSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  hourlyLimit: z.number().int().min(1).max(1000).default(100),
  // If not provided, a new Ethereal account is created automatically
  etherealUser: z.string().optional(),
  etherealPass: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().optional(),
  smtpSecure: z.boolean().optional(),
});

// GET /api/senders
router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const senderRepo = AppDataSource.getRepository(Sender);
    const senders = await senderRepo.find({ order: { createdAt: 'DESC' } });
    // Mask passwords in response
    const masked = senders.map(s => ({ ...s, etherealPass: '***' }));
    res.json({ senders: masked });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/senders
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = CreateSenderSchema.parse(req.body);
    const senderRepo = AppDataSource.getRepository(Sender);

    let etherealUser = data.etherealUser;
    let etherealPass = data.etherealPass;

    // Auto-create Ethereal account if not provided
    if (!etherealUser || !etherealPass) {
      const account = await createEtherealAccount();
      etherealUser = account.user;
      etherealPass = account.pass;
    }

    const sender = senderRepo.create({
      name: data.name,
      email: data.email,
      etherealUser: etherealUser!,
      etherealPass: etherealPass!,
      smtpHost: data.smtpHost || 'smtp.ethereal.email',
      smtpPort: data.smtpPort || 587,
      smtpSecure: data.smtpSecure ?? false,
      hourlyLimit: data.hourlyLimit,
    });

    await senderRepo.save(sender);
    res.status(201).json({ sender: { ...sender, etherealPass: '***' } });
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// POST /api/senders/seed — Auto-create 3 demo senders with Ethereal accounts
router.post('/seed', requireAuth, async (_req: Request, res: Response) => {
  try {
    const senderRepo = AppDataSource.getRepository(Sender);
    const existing = await senderRepo.count();
    if (existing > 0) {
      return res.json({ message: 'Senders already seeded', count: existing });
    }

    const demoSenders = [
      { name: 'ReachInbox Sender 1', email: 'sender1@reachinbox.com', hourlyLimit: 100 },
      { name: 'ReachInbox Sender 2', email: 'sender2@reachinbox.com', hourlyLimit: 150 },
      { name: 'ReachInbox Sender 3', email: 'sender3@reachinbox.com', hourlyLimit: 200 },
    ];

    const created = [];
    for (const demo of demoSenders) {
      const account = await createEtherealAccount();
      const sender = senderRepo.create({
        ...demo,
        etherealUser: account.user,
        etherealPass: account.pass,
      });
      await senderRepo.save(sender);
      created.push({ ...sender, etherealPass: '***' });
    }

    res.status(201).json({ message: 'Seeded 3 demo senders', senders: created });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
