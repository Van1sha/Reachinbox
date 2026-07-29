import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

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
