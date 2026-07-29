import { DataSource } from 'typeorm';
import { Sender } from '../models/Sender';
import { Campaign } from '../models/Campaign';
import { EmailJob } from '../models/EmailJob';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Sender, Campaign, EmailJob],
  synchronize: true, // use migrations in prod
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : false,
});
