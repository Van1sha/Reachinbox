import { EmailJobStatus, CampaignStatus } from '@/types';

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(dateStr));
}

export function formatTimeOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(new Date(dateStr));
}

export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const absDiff = Math.abs(diff);

  if (absDiff < 60000) return 'just now';
  if (absDiff < 3600000) {
    const mins = Math.round(absDiff / 60000);
    return diff > 0 ? `in ${mins}m` : `${mins}m ago`;
  }
  if (absDiff < 86400000) {
    const hrs = Math.round(absDiff / 3600000);
    return diff > 0 ? `in ${hrs}h` : `${hrs}h ago`;
  }
  const days = Math.round(absDiff / 86400000);
  return diff > 0 ? `in ${days}d` : `${days}d ago`;
}

export function parseEmailsFromText(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  // Deduplicate
  return [...new Set(matches.map((e) => e.toLowerCase()))];
}

export function parseCSV(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const emails: string[] = [];
  for (const line of lines) {
    const parts = line.split(',');
    for (const part of parts) {
      const trimmed = part.trim().replace(/^["']|["']$/g, '');
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        emails.push(trimmed.toLowerCase());
      }
    }
  }
  return [...new Set(emails)];
}

export const STATUS_CONFIG: Record<
  EmailJobStatus,
  { label: string; color: string; bg: string; dot: string; emoji: string }
> = {
  scheduled: {
    label: 'Scheduled',
    color: 'text-purple-400',
    bg: 'bg-purple-500/20 border-purple-500/30',
    dot: 'bg-purple-400',
    emoji: '📅',
  },
  queued: {
    label: 'Queued',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/20 border-yellow-500/30',
    dot: 'bg-yellow-400',
    emoji: '⏳',
  },
  sending: {
    label: 'Sending',
    color: 'text-blue-400',
    bg: 'bg-blue-500/20 border-blue-500/30',
    dot: 'bg-blue-400 animate-pulse',
    emoji: '🔵',
  },
  sent: {
    label: 'Sent',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20 border-emerald-500/30',
    dot: 'bg-emerald-400',
    emoji: '✅',
  },
  failed: {
    label: 'Failed',
    color: 'text-red-400',
    bg: 'bg-red-500/20 border-red-500/30',
    dot: 'bg-red-400',
    emoji: '❌',
  },
  retrying: {
    label: 'Retrying',
    color: 'text-orange-400',
    bg: 'bg-orange-500/20 border-orange-500/30',
    dot: 'bg-orange-400 animate-pulse',
    emoji: '🔄',
  },
};

export const CAMPAIGN_STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; color: string; bg: string }
> = {
  scheduled: {
    label: 'Scheduled',
    color: 'text-purple-400',
    bg: 'bg-purple-500/20 border-purple-500/30',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-blue-400',
    bg: 'bg-blue-500/20 border-blue-500/30',
  },
  completed: {
    label: 'Completed',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20 border-emerald-500/30',
  },
  failed: {
    label: 'Failed',
    color: 'text-red-400',
    bg: 'bg-red-500/20 border-red-500/30',
  },
  paused: {
    label: 'Paused',
    color: 'text-gray-400',
    bg: 'bg-gray-500/20 border-gray-500/30',
  },
};

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
