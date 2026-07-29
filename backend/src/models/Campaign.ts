import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Sender } from './Sender';
import { EmailJob } from './EmailJob';

export type CampaignStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'paused';

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 500 })
  subject!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'created_by', length: 255 })
  createdBy!: string;

  @Column({
    type: 'enum',
    enum: ['scheduled', 'in_progress', 'completed', 'failed', 'paused'],
    default: 'scheduled',
  })
  status!: CampaignStatus;

  @Column({ name: 'scheduled_at', type: 'timestamptz' })
  scheduledAt!: Date;

  @Column({ name: 'hourly_limit', default: 100 })
  hourlyLimit!: number;

  @Column({ name: 'delay_between_emails_ms', default: 2000 })
  delayBetweenEmailsMs!: number;

  @Column({ name: 'total_recipients', default: 0 })
  totalRecipients!: number;

  @Column({ name: 'sent_count', default: 0 })
  sentCount!: number;

  @Column({ name: 'failed_count', default: 0 })
  failedCount!: number;

  @ManyToOne(() => Sender, (sender) => sender.campaigns, { nullable: false })
  @JoinColumn({ name: 'sender_id' })
  sender!: Sender;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => EmailJob, (job) => job.campaign, { cascade: true })
  jobs!: EmailJob[];
}
