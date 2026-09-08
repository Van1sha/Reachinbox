import 'dotenv/config';
import { Redis } from 'ioredis';

export function sanitizeRedisUrl(raw?: string): string {
  if (!raw) return 'redis://localhost:6379';
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

export const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required for BullMQ
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    console.log(`Redis reconnecting... attempt ${times}`);
    return delay;
  },
});

redisClient.on('connect', () => console.log('Redis client connected'));
redisClient.on('error', (err) => console.error('Redis error:', err));

// Separate connection for BullMQ (it needs its own)
export const createRedisConnection = () =>
  new Redis(redisUrl, { maxRetriesPerRequest: null });
