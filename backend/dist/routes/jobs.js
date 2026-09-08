"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const EmailJob_1 = require("../models/EmailJob");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// GET /api/jobs?campaignId=&status=&page=&limit=
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const jobRepo = database_1.AppDataSource.getRepository(EmailJob_1.EmailJob);
        const { campaignId, status, page = '1', limit = '50' } = req.query;
        const qb = jobRepo
            .createQueryBuilder('job')
            .leftJoinAndSelect('job.campaign', 'campaign')
            .orderBy('job.estimatedSendTime', 'ASC')
            .skip((parseInt(String(page)) - 1) * parseInt(String(limit)))
            .take(parseInt(String(limit)));
        if (campaignId)
            qb.andWhere('campaign.id = :campaignId', { campaignId });
        if (status)
            qb.andWhere('job.status = :status', { status });
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// GET /api/jobs/:id
router.get('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const jobRepo = database_1.AppDataSource.getRepository(EmailJob_1.EmailJob);
        const job = await jobRepo.findOne({
            where: { id: req.params.id },
            relations: ['campaign', 'campaign.sender'],
        });
        if (!job)
            return res.status(404).json({ error: 'Job not found' });
        res.json({ job });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
