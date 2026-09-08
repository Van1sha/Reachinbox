"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const SseEmitter_1 = require("../services/SseEmitter");
const router = (0, express_1.Router)();
/**
 * GET /api/events
 * Server-Sent Events endpoint for real-time dashboard updates.
 * The frontend connects here once and receives push notifications for:
 *  - job:sending, job:sent, job:failed, job:retrying, job:rescheduled
 *  - campaign:created, campaign:completed
 */
router.get('/', (req, res) => {
    const clientId = (0, uuid_1.v4)();
    // SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    // Send initial heartbeat
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);
    // Register client
    SseEmitter_1.sseEmitter.addClient(clientId, res);
    // Heartbeat every 30s to keep connection alive
    const heartbeat = setInterval(() => {
        try {
            res.write(': heartbeat\n\n');
        }
        catch {
            clearInterval(heartbeat);
        }
    }, 30000);
    // Cleanup on disconnect
    req.on('close', () => {
        clearInterval(heartbeat);
        SseEmitter_1.sseEmitter.removeClient(clientId);
    });
});
exports.default = router;
