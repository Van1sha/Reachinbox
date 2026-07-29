import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import { Redis as IoRedis } from 'ioredis';
import RedisStore from 'connect-redis';
import passport from 'passport';

import { AppDataSource } from './config/database';
import { redisClient } from './config/redis';
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

// Security & Parsing
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Session with Redis store (using ioredis)
const sessionRedis = new IoRedis(process.env.REDIS_URL || 'redis://localhost:6379', {
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
    startWorker();
    console.log('✅ BullMQ worker started');

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`📊 Bull Board at http://localhost:${PORT}/admin/queues`);
    });
  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    process.exit(1);
  }
}

bootstrap();
