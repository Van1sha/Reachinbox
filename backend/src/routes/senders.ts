import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AppDataSource } from '../config/database';
import { Sender } from '../models/Sender';
import { createEtherealAccount } from '../services/EmailSender';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Default SMTP settings can be provided via environment variables so that
// every new sender is pre-wired to the real provider without manual entry.
// Supported env vars:
//   SMTP_HOST      e.g. smtp.gmail.com / smtp.sendgrid.net
//   SMTP_PORT      e.g. 587
//   SMTP_SECURE    e.g. false (true for port 465)
//   SMTP_USER      SMTP username / API key (e.g. "apikey" for SendGrid)
//   SMTP_PASS      SMTP password / API secret
const DEFAULT_SMTP_HOST   = process.env.SMTP_HOST   || 'smtp.gmail.com';
const DEFAULT_SMTP_PORT   = parseInt(process.env.SMTP_PORT   || '587');
const DEFAULT_SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const DEFAULT_SMTP_USER   = process.env.SMTP_USER   || '';
const DEFAULT_SMTP_PASS   = process.env.SMTP_PASS   || '';

const CreateSenderSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  hourlyLimit: z.number().int().min(1).max(1000).default(100),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().optional(),
  smtpSecure: z.boolean().optional(),
  // Legacy Ethereal fields — accepted but ignored when smtpUser/Pass are set
  etherealUser: z.string().optional(),
  etherealPass: z.string().optional(),
});

// GET /api/senders
router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const senderRepo = AppDataSource.getRepository(Sender);
    const senders = await senderRepo.find({ order: { createdAt: 'DESC' } });
    // Mask passwords in response
    const masked = senders.map(s => ({ ...s, smtpPass: '***', etherealPass: '***' }));
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

    // Resolve SMTP credentials: request body → env var defaults
    const isExplicitResend = data.smtpHost === 'smtp.resend.com';
    const isExplicitBrevo = data.smtpHost === 'smtp-relay.brevo.com' || data.smtpHost === 'smtp.brevo.com';
    const isExplicitOtherHost = Boolean(data.smtpHost && data.smtpHost !== 'smtp.resend.com');

    let smtpPass = data.smtpPass || data.etherealPass || DEFAULT_SMTP_PASS || (!isExplicitOtherHost ? process.env.RESEND_API_KEY : '') || process.env.BREVO_API_KEY || '';
    if (data.smtpHost?.includes('gmail') && smtpPass) {
      smtpPass = smtpPass.replace(/\s+/g, '');
    }

    const isBrevo = smtpPass.startsWith('xkeysib-') || isExplicitBrevo || Boolean(process.env.BREVO_API_KEY);
    const isResend = !isBrevo && !isExplicitOtherHost && (smtpPass.startsWith('re_') || isExplicitResend || Boolean(process.env.RESEND_API_KEY));
    const smtpUser = data.smtpUser || data.etherealUser || (isResend ? 'resend' : (isBrevo ? data.email : DEFAULT_SMTP_USER));
    const smtpHost = data.smtpHost || (isResend ? 'smtp.resend.com' : (isBrevo ? 'smtp-relay.brevo.com' : DEFAULT_SMTP_HOST));
    const smtpPort = data.smtpPort || (isResend ? 465 : DEFAULT_SMTP_PORT);
    const smtpSecure = data.smtpSecure ?? (isResend ? true : (smtpPort === 465 ? true : DEFAULT_SMTP_SECURE));

    if (!smtpUser || !smtpPass) {
      return res.status(400).json({
        error: 'SMTP credentials are required. Provide smtpUser/smtpPass in the request or set SMTP_USER/SMTP_PASS, BREVO_API_KEY, or RESEND_API_KEY environment variables.',
      });
    }

    const sender = senderRepo.create({
      name: data.name,
      email: data.email,
      smtpUser,
      smtpPass,
      smtpHost,
      smtpPort,
      smtpSecure,
      hourlyLimit: data.hourlyLimit,
      // Keep legacy columns nullable; they are no longer auto-generated
      etherealUser: (data.etherealUser || null) as unknown as string,
      etherealPass: (data.etherealPass || null) as unknown as string,
    });

    await senderRepo.save(sender);
    res.status(201).json({ sender: { ...sender, smtpPass: '***', etherealPass: '***' } });
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// POST /api/senders/seed — Auto-create 3 demo senders using env-var SMTP config
router.post('/seed', requireAuth, async (_req: Request, res: Response) => {
  try {
    const senderRepo = AppDataSource.getRepository(Sender);
    const existing = await senderRepo.count();
    if (existing > 0) {
      return res.json({ message: 'Senders already seeded', count: existing });
    }

    if (!DEFAULT_SMTP_USER || !DEFAULT_SMTP_PASS) {
      return res.status(400).json({
        error: 'Cannot seed senders: SMTP_USER and SMTP_PASS environment variables are not set.',
      });
    }

    const demoSenders = [
      { name: 'ReachInbox Sender 1', email: 'sender1@reachinbox.com', hourlyLimit: 100 },
      { name: 'ReachInbox Sender 2', email: 'sender2@reachinbox.com', hourlyLimit: 150 },
      { name: 'ReachInbox Sender 3', email: 'sender3@reachinbox.com', hourlyLimit: 200 },
    ];

    const created = [];
    for (const demo of demoSenders) {
      const sender = senderRepo.create({
        ...demo,
        smtpUser: DEFAULT_SMTP_USER,
        smtpPass: DEFAULT_SMTP_PASS,
        smtpHost: DEFAULT_SMTP_HOST,
        smtpPort: DEFAULT_SMTP_PORT,
        smtpSecure: DEFAULT_SMTP_SECURE,
      });
      await senderRepo.save(sender);
      created.push({ ...sender, smtpPass: '***' });
    }

    res.status(201).json({ message: 'Seeded 3 demo senders', senders: created });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
