"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../config/database");
const Sender_1 = require("../models/Sender");
const EmailSender_1 = require("../services/EmailSender");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const CreateSenderSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    email: zod_1.z.string().email(),
    hourlyLimit: zod_1.z.number().int().min(1).max(1000).default(100),
    // If not provided, a new Ethereal account is created automatically
    etherealUser: zod_1.z.string().optional(),
    etherealPass: zod_1.z.string().optional(),
    smtpHost: zod_1.z.string().optional(),
    smtpPort: zod_1.z.number().int().optional(),
    smtpSecure: zod_1.z.boolean().optional(),
});
// GET /api/senders
router.get('/', auth_1.requireAuth, async (_req, res) => {
    try {
        const senderRepo = database_1.AppDataSource.getRepository(Sender_1.Sender);
        const senders = await senderRepo.find({ order: { createdAt: 'DESC' } });
        // Mask passwords in response
        const masked = senders.map(s => ({ ...s, etherealPass: '***' }));
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
        let etherealUser = data.etherealUser;
        let etherealPass = data.etherealPass;
        // Auto-create Ethereal account if not provided
        if (!etherealUser || !etherealPass) {
            const account = await (0, EmailSender_1.createEtherealAccount)();
            etherealUser = account.user;
            etherealPass = account.pass;
        }
        const sender = senderRepo.create({
            name: data.name,
            email: data.email,
            etherealUser: etherealUser,
            etherealPass: etherealPass,
            smtpHost: data.smtpHost || 'smtp.ethereal.email',
            smtpPort: data.smtpPort || 587,
            smtpSecure: data.smtpSecure ?? false,
            hourlyLimit: data.hourlyLimit,
        });
        await senderRepo.save(sender);
        res.status(201).json({ sender: { ...sender, etherealPass: '***' } });
    }
    catch (error) {
        if (error.name === 'ZodError')
            return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: error.message });
    }
});
// POST /api/senders/seed — Auto-create 3 demo senders with Ethereal accounts
router.post('/seed', auth_1.requireAuth, async (_req, res) => {
    try {
        const senderRepo = database_1.AppDataSource.getRepository(Sender_1.Sender);
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
            const account = await (0, EmailSender_1.createEtherealAccount)();
            const sender = senderRepo.create({
                ...demo,
                etherealUser: account.user,
                etherealPass: account.pass,
            });
            await senderRepo.save(sender);
            created.push({ ...sender, etherealPass: '***' });
        }
        res.status(201).json({ message: 'Seeded 3 demo senders', senders: created });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
