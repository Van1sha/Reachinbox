"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const Campaign_1 = require("../models/Campaign");
const EmailJob_1 = require("../models/EmailJob");
const auth_1 = require("../middleware/auth");
const emailQueue_1 = require("../queues/emailQueue");
const router = (0, express_1.Router)();
// GET /api/stats — Dashboard stats
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const campaignRepo = database_1.AppDataSource.getRepository(Campaign_1.Campaign);
        const jobRepo = database_1.AppDataSource.getRepository(EmailJob_1.EmailJob);
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
            emailQueue_1.emailQueue.getWaitingCount(),
            emailQueue_1.emailQueue.getActiveCount(),
            emailQueue_1.emailQueue.getDelayedCount(),
            emailQueue_1.emailQueue.getFailedCount(),
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
