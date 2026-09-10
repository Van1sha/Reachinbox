"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../config/database");
const Sender_1 = require("../models/Sender");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Default SMTP settings can be provided via environment variables so that
// every new sender is pre-wired to the real provider without manual entry.
// Supported env vars:
//   SMTP_HOST      e.g. smtp.gmail.com / smtp.sendgrid.net
//   SMTP_PORT      e.g. 587
//   SMTP_SECURE    e.g. false (true for port 465)
//   SMTP_USER      SMTP username / API key (e.g. "apikey" for SendGrid)
//   SMTP_PASS      SMTP password / API secret
const DEFAULT_SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const DEFAULT_SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const DEFAULT_SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const DEFAULT_SMTP_USER = process.env.SMTP_USER || '';
const DEFAULT_SMTP_PASS = process.env.SMTP_PASS || '';
const CreateSenderSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    email: zod_1.z.string().email(),
    hourlyLimit: zod_1.z.number().int().min(1).max(1000).default(100),
    smtpUser: zod_1.z.string().optional(),
    smtpPass: zod_1.z.string().optional(),
    smtpHost: zod_1.z.string().optional(),
    smtpPort: zod_1.z.number().int().optional(),
    smtpSecure: zod_1.z.boolean().optional(),
    // Legacy Ethereal fields — accepted but ignored when smtpUser/Pass are set
    etherealUser: zod_1.z.string().optional(),
    etherealPass: zod_1.z.string().optional(),
});
// GET /api/senders
router.get('/', auth_1.requireAuth, async (_req, res) => {
    try {
        const senderRepo = database_1.AppDataSource.getRepository(Sender_1.Sender);
        const senders = await senderRepo.find({ order: { createdAt: 'DESC' } });
        // Mask passwords in response
        const masked = senders.map(s => ({ ...s, smtpPass: '***', etherealPass: '***' }));
        res.json({ senders: masked });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// POST /api/senders
router.post('/', auth_1.requireAuth, async (req, res) => {
    try {
        const data = CreateSenderSchema.parse(req.body);
        const senderRepo = database_1.AppDataSource.getRepository(Sender_1.Sender);
        // Resolve SMTP credentials: request body → env var defaults
        const isExplicitResend = data.smtpHost === 'smtp.resend.com';
        const isExplicitOtherHost = Boolean(data.smtpHost && data.smtpHost !== 'smtp.resend.com');
        let smtpPass = data.smtpPass || data.etherealPass || DEFAULT_SMTP_PASS || (!isExplicitOtherHost ? process.env.RESEND_API_KEY : '') || '';
        if (data.smtpHost?.includes('gmail') && smtpPass) {
            smtpPass = smtpPass.replace(/\s+/g, '');
        }
        const isResend = !isExplicitOtherHost && (smtpPass.startsWith('re_') || isExplicitResend || Boolean(process.env.RESEND_API_KEY));
        const smtpUser = data.smtpUser || data.etherealUser || (isResend ? 'resend' : DEFAULT_SMTP_USER);
        const smtpHost = data.smtpHost || (isResend ? 'smtp.resend.com' : DEFAULT_SMTP_HOST);
        const smtpPort = data.smtpPort || (isResend ? 465 : DEFAULT_SMTP_PORT);
        const smtpSecure = data.smtpSecure ?? (isResend ? true : (smtpPort === 465 ? true : DEFAULT_SMTP_SECURE));
        if (!smtpUser || !smtpPass) {
            return res.status(400).json({
                error: 'SMTP credentials are required. Provide smtpUser/smtpPass in the request or set SMTP_USER/SMTP_PASS or RESEND_API_KEY environment variables.',
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
            etherealUser: (data.etherealUser || null),
            etherealPass: (data.etherealPass || null),
        });
        await senderRepo.save(sender);
        res.status(201).json({ sender: { ...sender, smtpPass: '***', etherealPass: '***' } });
    }
    catch (error) {
        if (error.name === 'ZodError')
            return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: error.message });
    }
});
// POST /api/senders/seed — Auto-create 3 demo senders using env-var SMTP config
router.post('/seed', auth_1.requireAuth, async (_req, res) => {
    try {
        const senderRepo = database_1.AppDataSource.getRepository(Sender_1.Sender);
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
