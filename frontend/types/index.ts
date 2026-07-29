// Shared TypeScript types for API responses and component props

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  provider: string;
}

export type CampaignStatus = 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'paused';
export type EmailJobStatus = 'scheduled' | 'queued' | 'sending' | 'sent' | 'failed' | 'retrying';

export interface Sender {
  id: string;
  name: string;
  email: string;
  etherealUser: string;
  hourlyLimit: number;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  createdAt: string;
}

export interface Campaign {
  id: string;
  subject: string;
  body: string;
  createdBy: string;
  status: CampaignStatus;
  scheduledAt: string;
  hourlyLimit: number;
  delayBetweenEmailsMs: number;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  sender: Sender;
  createdAt: string;
  updatedAt: string;
}

export interface EmailJob {
  id: string;
  recipientEmail: string;
  bullJobId: string;
  status: EmailJobStatus;
  estimatedSendTime: string | null;
  actualSentTime: string | null;
  retryCount: number;
  nextRetryAt: string | null;
  errorMessage: string | null;
  messageId: string | null;
  previewUrl: string | null;
  campaign: Campaign;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface CampaignsResponse {
  campaigns: Campaign[];
  pagination: PaginationMeta;
}

export interface JobsResponse {
  jobs: EmailJob[];
  pagination: PaginationMeta;
}

export interface Stats {
  campaigns: {
    total: number;
    scheduled: number;
    completed: number;
  };
  emails: {
    total: number;
    sent: number;
    failed: number;
    scheduled: number;
  };
  queue: {
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
  };
}

export interface AdaptivePlanPreview {
  totalEmails: number;
  estimatedTimes: string[];
  hoursSpanned: number;
  firstSendTime: string;
  lastSendTime: string;
  slotsRemainingCurrentHour: number;
}

// SSE Event payloads
export interface SseJobSentEvent {
  jobId: string;
  campaignId: string;
  recipientEmail: string;
  sentAt: string;
  previewUrl: string | null;
}

export interface SseJobStatusEvent {
  jobId: string;
  campaignId: string;
  recipientEmail: string;
  status: EmailJobStatus;
  newEstimatedTime?: string;
  retryCount?: number;
  nextRetryAt?: string;
  delayMs?: number;
  reason?: string;
}

export interface SseCampaignEvent {
  campaignId: string;
  totalRecipients?: number;
  firstSendTime?: string;
  lastSendTime?: string;
}

// Compose form types
export interface ComposeFormData {
  subject: string;
  body: string;
  recipients: string[];
  senderId: string;
  scheduledAt: string;
  hourlyLimit: number;
  delayBetweenEmailsMs: number;
}
