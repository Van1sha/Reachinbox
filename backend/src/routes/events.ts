import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { sseEmitter } from '../services/SseEmitter';

const router = Router();

/**
 * GET /api/events
 * Server-Sent Events endpoint for real-time dashboard updates.
 * The frontend connects here once and receives push notifications for:
 *  - job:sending, job:sent, job:failed, job:retrying, job:rescheduled
 *  - campaign:created, campaign:completed
 */
router.get('/', (req: Request, res: Response) => {
  const clientId = uuidv4();

  // SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial heartbeat
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);

  // Register client
  sseEmitter.addClient(clientId, res);

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    sseEmitter.removeClient(clientId);
  });
});

export default router;
