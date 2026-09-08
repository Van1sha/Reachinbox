"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../config/database");
const Campaign_1 = require("../models/Campaign");
const AdaptiveScheduler_1 = require("../services/AdaptiveScheduler");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const ScheduleCampaignSchema = zod_1.z.object({
    subject: zod_1.z.string().min(1).max(500),
    body: zod_1.z.string().min(1),
    recipients: zod_1.z.array(zod_1.z.string().email()).min(1).max(10000),
    senderId: zod_1.z.string().uuid(),
    scheduledAt: zod_1.z.string().datetime(),
    hourlyLimit: zod_1.z.number().int().min(1).max(1000).default(100),
    delayBetweenEmailsMs: zod_1.z.number().int().min(1000).default(2000),
});
const PreviewSchema = zod_1.z.object({
    senderId: zod_1.z.string().uuid(),
    hourlyLimit: zod_1.z.number().int().min(1).max(1000),
    totalEmails: zod_1.z.number().int().min(1),
    startTime: zod_1.z.string().datetime(),
    delayBetweenEmailsMs: zod_1.z.number().int().min(1000),
});
// GET /api/campaigns
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const campaignRepo = database_1.AppDataSource.getRepository(Campaign_1.Campaign);
        const { status, createdBy, page = '1', limit = '20' } = req.query;
        const qb = campaignRepo
            .createQueryBuilder('campaign')
            .leftJoinAndSelect('campaign.sender', 'sender')
            .orderBy('campaign.createdAt', 'DESC')
            .skip((parseInt(String(page)) - 1) * parseInt(String(limit)))
            .take(parseInt(String(limit)));
        if (status)
            qb.andWhere('campaign.status = :status', { status });
        if (createdBy)
            qb.andWhere('campaign.createdBy = :createdBy', { createdBy });
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// GET /api/campaigns/:id
router.get('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const campaignRepo = database_1.AppDataSource.getRepository(Campaign_1.Campaign);
        const campaign = await campaignRepo.findOne({
            where: { id: req.params.id },
            relations: ['sender'],
        });
        if (!campaign)
            return res.status(404).json({ error: 'Campaign not found' });
        res.json({ campaign });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// POST /api/campaigns/preview — Preview adaptive schedule before submitting
router.post('/preview', auth_1.requireAuth, async (req, res) => {
    try {
        const data = PreviewSchema.parse(req.body);
        const plan = await AdaptiveScheduler_1.adaptiveScheduler.previewPlan({
            senderId: data.senderId,
            hourlyLimit: data.hourlyLimit,
            totalEmails: data.totalEmails,
            startTime: new Date(data.startTime),
            delayBetweenEmailsMs: data.delayBetweenEmailsMs,
        });
        res.json({ plan });
    }
    catch (error) {
        if (error.name === 'ZodError')
            return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: error.message });
    }
});
// POST /api/campaigns — Schedule a new campaign
router.post('/', auth_1.requireAuth, async (req, res) => {
    try {
        const data = ScheduleCampaignSchema.parse(req.body);
        const user = req.user;
        const campaign = await AdaptiveScheduler_1.adaptiveScheduler.schedule({
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
    }
    catch (error) {
        if (error.name === 'ZodError')
            return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
