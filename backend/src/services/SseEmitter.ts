import { EventEmitter } from 'events';
import { Response } from 'express';

/**
 * Server-Sent Events emitter for real-time frontend updates.
 * Uses Node's EventEmitter internally, broadcasts to all connected SSE clients.
 */
class SseEmitter extends EventEmitter {
  private clients: Map<string, Response> = new Map();

  addClient(id: string, res: Response) {
    this.clients.set(id, res);
    console.log(`SSE client connected: ${id} (total: ${this.clients.size})`);
  }

  removeClient(id: string) {
    this.clients.delete(id);
    console.log(`SSE client disconnected: ${id} (total: ${this.clients.size})`);
  }

  broadcast(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, res] of this.clients) {
      try {
        res.write(payload);
      } catch {
        this.removeClient(id);
      }
    }
  }

  emit(event: string, data?: unknown): boolean {
    this.broadcast(event, data);
    return super.emit(event, data);
  }
}

export const sseEmitter = new SseEmitter();
export default sseEmitter;
