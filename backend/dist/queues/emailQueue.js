"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
exports.emailQueue = new bullmq_1.Queue('email-sends', {
    connection: (0, redis_1.createRedisConnection)(),
    defaultJobOptions: {
        attempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '5'),
        backoff: {
            type: 'custom',
        },
        removeOnComplete: { count: 1000, age: 7 * 24 * 3600 },
        removeOnFail: false,
    },
});
