"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
require("reflect-metadata");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_session_1 = __importDefault(require("express-session"));
const ioredis_1 = require("ioredis");
const connect_redis_1 = __importDefault(require("connect-redis"));
const passport_1 = __importDefault(require("passport"));
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const passport_2 = require("./config/passport");
const emailQueue_1 = require("./queues/emailQueue");
const emailWorker_1 = require("./workers/emailWorker");
const bullboard_1 = require("./config/bullboard");
const auth_1 = __importDefault(require("./routes/auth"));
const campaigns_1 = __importDefault(require("./routes/campaigns"));
const jobs_1 = __importDefault(require("./routes/jobs"));
const stats_1 = __importDefault(require("./routes/stats"));
const senders_1 = __importDefault(require("./routes/senders"));
const events_1 = __importDefault(require("./routes/events"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}
// Security & Parsing
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// CORS
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
// Session with Redis store (using ioredis)
const sessionRedis = new ioredis_1.Redis((0, redis_1.sanitizeRedisUrl)(process.env.REDIS_URL), {
    maxRetriesPerRequest: null,
});
app.use((0, express_session_1.default)({
    store: new connect_redis_1.default({ client: sessionRedis }),
    secret: process.env.SESSION_SECRET || 'dev_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
}));
// Passport
(0, passport_2.setupPassport)();
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// Bull Board (monitoring dashboard)
const { router: bullBoardRouter } = (0, bullboard_1.setupBullBoard)(emailQueue_1.emailQueue);
app.use('/admin/queues', bullBoardRouter);
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/campaigns', campaigns_1.default);
app.use('/api/jobs', jobs_1.default);
app.use('/api/stats', stats_1.default);
app.use('/api/senders', senders_1.default);
app.use('/api/events', events_1.default);
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Bootstrap
async function bootstrap() {
    try {
        // Connect to PostgreSQL
        await database_1.AppDataSource.initialize();
        console.log('✅ PostgreSQL connected');
        // Run migrations/sync
        await database_1.AppDataSource.synchronize();
        console.log('✅ Database schema synchronized');
        // Connect to Redis
        await redis_1.redisClient.ping();
        console.log('✅ Redis connected');
        // Start BullMQ Worker
        const worker = (0, emailWorker_1.startWorker)();
        console.log('✅ BullMQ worker started');
        // Start server
        const server = app.listen(PORT, () => {
            console.log(`🚀 Server running at http://localhost:${PORT}`);
            console.log(`📊 Bull Board at http://localhost:${PORT}/admin/queues`);
        });
        // Graceful shutdown — give in-flight jobs a chance to finish before exit.
        // Without this, a SIGTERM from a deploy/restart can orphan active BullMQ
        // jobs, leaving them stuck in "active" state and blocking future retries.
        const shutdown = async (signal) => {
            console.log(`\n⚠️  ${signal} received — shutting down gracefully…`);
            server.close();
            try {
                await worker.close();
                console.log('✅ BullMQ worker closed');
            }
            catch (err) {
                console.error('❌ Error closing worker:', err);
            }
            process.exit(0);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
    catch (error) {
        console.error('❌ Bootstrap failed:', error);
        process.exit(1);
    }
}
bootstrap();
