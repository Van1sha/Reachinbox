import 'dotenv/config';
import 'reflect-metadata';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import { Redis as IoRedis } from 'ioredis';
import RedisStore from 'connect-redis';
import passport from 'passport';

import { AppDataSource } from './config/database';
import { redisClient, sanitizeRedisUrl } from './config/redis';
import { setupPassport } from './config/passport';
import { emailQueue } from './queues/emailQueue';
import { startWorker } from './workers/emailWorker';
import { setupBullBoard } from './config/bullboard';

import authRoutes from './routes/auth';
import campaignRoutes from './routes/campaigns';
import jobRoutes from './routes/jobs';
import statsRoutes from './routes/stats';
import senderRoutes from './routes/senders';
import eventsRoutes from './routes/events';

const app = express();
const PORT = process.env.PORT || 4000;

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security & Parsing
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS
const configuredFrontend = process.env.FRONTEND_URL?.trim().replace(/\/$/, '');

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    // Allow if matches FRONTEND_URL, is on vercel.app, is localhost, or if placeholder was left
    if (
      !configuredFrontend ||
      configuredFrontend === 'https://your-app.vercel.app' ||
      origin === configuredFrontend ||
      origin.endsWith('.vercel.app') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    ) {
      return callback(null, true);
    }

    // Fallback: allow origin to prevent CORS blocking across deployments
    return callback(null, true);
  },
  credentials: true,
}));

// Session with Redis store (using ioredis)
const sessionRedis = new IoRedis(sanitizeRedisUrl(process.env.REDIS_URL), {
  maxRetriesPerRequest: null,
});

app.use(session({
  store: new RedisStore({ client: sessionRedis as any }),
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
setupPassport();
app.use(passport.initialize());
app.use(passport.session());

// Bull Board (monitoring dashboard)
const { router: bullBoardRouter } = setupBullBoard(emailQueue);
app.use('/admin/queues', bullBoardRouter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/senders', senderRoutes);
app.use('/api/events', eventsRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Bootstrap
async function bootstrap() {
  try {
    // Connect to PostgreSQL
    await AppDataSource.initialize();
    console.log('✅ PostgreSQL connected');

    // Run migrations/sync
    await AppDataSource.synchronize();
    console.log('✅ Database schema synchronized');

    // Connect to Redis
    await redisClient.ping();
    console.log('✅ Redis connected');

    // Start BullMQ Worker
    const worker = startWorker();
    console.log('✅ BullMQ worker started');

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`📊 Bull Board at http://localhost:${PORT}/admin/queues`);
    });

    // Graceful shutdown — give in-flight jobs a chance to finish before exit.
    // Without this, a SIGTERM from a deploy/restart can orphan active BullMQ
    // jobs, leaving them stuck in "active" state and blocking future retries.
    const shutdown = async (signal: string) => {
      console.log(`\n⚠️  ${signal} received — shutting down gracefully…`);
      server.close();
      try {
        await worker.close();
        console.log('✅ BullMQ worker closed');
      } catch (err) {
        console.error('❌ Error closing worker:', err);
      }
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    process.exit(1);
  }
}

bootstrap();
