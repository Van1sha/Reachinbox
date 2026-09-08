"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRedisConnection = exports.redisClient = void 0;
exports.sanitizeRedisUrl = sanitizeRedisUrl;
require("dotenv/config");
const ioredis_1 = require("ioredis");
function sanitizeRedisUrl(raw) {
    if (!raw)
        return 'redis://localhost:6379';
    let cleaned = raw.trim();
    // If user pasted a CLI command (e.g. "redis-cli --tls -u rediss://...")
    const urlMatch = cleaned.match(/(rediss?:\/\/[^\s'"]+)/);
    if (urlMatch) {
        cleaned = urlMatch[1];
    }
    // If connected to Upstash without rediss:// protocol, ensure TLS
    if (cleaned.includes('upstash.io') && cleaned.startsWith('redis://')) {
        cleaned = cleaned.replace('redis://', 'rediss://');
    }
    return cleaned;
}
const redisUrl = sanitizeRedisUrl(process.env.REDIS_URL);
exports.redisClient = new ioredis_1.Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required for BullMQ
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        console.log(`Redis reconnecting... attempt ${times}`);
        return delay;
    },
});
exports.redisClient.on('connect', () => console.log('Redis client connected'));
exports.redisClient.on('error', (err) => console.error('Redis error:', err));
// Separate connection for BullMQ (it needs its own)
const createRedisConnection = () => new ioredis_1.Redis(redisUrl, { maxRetriesPerRequest: null });
exports.createRedisConnection = createRedisConnection;
