import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Campaign } from './Campaign';

@Entity('senders')
export class Sender {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ unique: true, length: 255 })
  email!: string;

  @Column({ name: 'ethereal_user', length: 255 })
  etherealUser!: string;

  @Column({ name: 'ethereal_pass', length: 255 })
  etherealPass!: string;

  @Column({ name: 'smtp_host', length: 255, default: 'smtp.ethereal.email' })
  smtpHost!: string;

  @Column({ name: 'smtp_port', default: 587 })
  smtpPort!: number;

  @Column({ name: 'smtp_secure', default: false })
  smtpSecure!: boolean;

  @Column({ name: 'hourly_limit', default: 100 })
  hourlyLimit!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => Campaign, (campaign) => campaign.sender)
  campaigns!: Campaign[];
}
