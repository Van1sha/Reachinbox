"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sseEmitter = void 0;
const events_1 = require("events");
/**
 * Server-Sent Events emitter for real-time frontend updates.
 * Uses Node's EventEmitter internally, broadcasts to all connected SSE clients.
 */
class SseEmitter extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.clients = new Map();
    }
    addClient(id, res) {
        this.clients.set(id, res);
        console.log(`SSE client connected: ${id} (total: ${this.clients.size})`);
    }
    removeClient(id) {
        this.clients.delete(id);
        console.log(`SSE client disconnected: ${id} (total: ${this.clients.size})`);
    }
    broadcast(event, data) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        for (const [id, res] of this.clients) {
            try {
                res.write(payload);
            }
            catch {
                this.removeClient(id);
            }
        }
    }
    emit(event, data) {
        this.broadcast(event, data);
        return super.emit(event, data);
    }
}
exports.sseEmitter = new SseEmitter();
exports.default = exports.sseEmitter;
