import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Campaign } from './Campaign';

export type EmailJobStatus =
  | 'scheduled'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'retrying';

@Entity('email_jobs')
export class EmailJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'recipient_email', length: 255 })
  recipientEmail!: string;

  @Column({ name: 'recipient_name', length: 255, nullable: true })
  recipientName!: string;

  @Index()
  @Column({ name: 'bull_job_id', length: 500, nullable: true })
  bullJobId!: string;

  @Column({
    type: 'enum',
    enum: ['scheduled', 'queued', 'sending', 'sent', 'failed', 'retrying'],
    default: 'scheduled',
  })
  status!: EmailJobStatus;

  @Column({ name: 'estimated_send_time', type: 'timestamptz', nullable: true })
  estimatedSendTime!: Date | null;

  @Column({ name: 'actual_sent_time', type: 'timestamptz', nullable: true })
  actualSentTime!: Date | null;

  @Column({ name: 'retry_count', default: 0 })
  retryCount!: number;

  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt!: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'message_id', type: 'varchar', length: 500, nullable: true })
  messageId!: string | null;

  @Column({ name: 'preview_url', type: 'varchar', length: 1000, nullable: true })
  previewUrl!: string | null;

  @ManyToOne(() => Campaign, (campaign) => campaign.jobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign!: Campaign;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
