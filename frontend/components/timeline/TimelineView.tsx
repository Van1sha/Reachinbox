'use client';

import { useEffect, useState, useCallback } from 'react';
import { EmailJob, EmailJobStatus, SseJobStatusEvent } from '@/types';
import { jobsApi } from '@/lib/api';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatTimeOnly, formatDateTime, formatRelativeTime } from '@/lib/utils';
import { TableSkeleton, EmptyState } from '@/components/ui/Skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface GroupedJobs {
  hourLabel: string;
  hourTime: Date;
  jobs: EmailJob[];
  isRateLimitWall?: boolean;
}

function groupJobsByHour(jobs: EmailJob[]): GroupedJobs[] {
  const groups: Map<string, GroupedJobs> = new Map();
  let prevHour: string | null = null;

  for (const job of jobs) {
    const time = job.estimatedSendTime ? new Date(job.estimatedSendTime) : new Date(job.createdAt);
    const hourKey = `${time.getFullYear()}-${time.getMonth()}-${time.getDate()}-${time.getHours()}`;

    if (!groups.has(hourKey)) {
      // Detect rate-limit wall (gap > 59 minutes between this and previous group)
      let isWall = false;
      if (prevHour) {
        const prevParts = prevHour.split('-').map(Number);
        const prevDate = new Date(prevParts[0], prevParts[1], prevParts[2], prevParts[3]);
        const diffMs = time.getTime() - prevDate.getTime();
        if (diffMs > 59 * 60 * 1000 && prevHour !== null) isWall = true;
      }

      groups.set(hourKey, {
        hourLabel: new Intl.DateTimeFormat('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          month: 'short',
          day: 'numeric',
        }).format(time),
        hourTime: time,
        jobs: [],
        isRateLimitWall: isWall,
      });
      prevHour = hourKey;
    }

    groups.get(hourKey)!.jobs.push(job);
  }

  return Array.from(groups.values());
}

interface TimelineItemProps {
  job: EmailJob;
  isNew?: boolean;
}

function TimelineItem({ job, isNew }: TimelineItemProps) {
  const statusConfig: Record<EmailJobStatus, { icon: string; pulse: boolean }> = {
    scheduled: { icon: '📅', pulse: false },
    queued: { icon: '⏳', pulse: false },
    sending: { icon: '🔵', pulse: true },
    sent: { icon: '✅', pulse: false },
    failed: { icon: '❌', pulse: false },
    retrying: { icon: '🔄', pulse: true },
  };
  const cfg = statusConfig[job.status];

  return (
    <div
      className={`relative flex items-start gap-4 p-4 rounded-xl border transition-all duration-500 glass-hover ${
        isNew ? 'animate-slide-in-right' : ''
      } ${
        job.status === 'sent'
          ? 'border-emerald-500/20 bg-emerald-500/5'
          : job.status === 'failed'
          ? 'border-red-500/20 bg-red-500/5'
          : job.status === 'sending'
          ? 'border-blue-500/30 bg-blue-500/10'
          : job.status === 'retrying'
          ? 'border-orange-500/20 bg-orange-500/5'
          : 'border-gray-800/50 bg-gray-900/30'
      }`}
    >
      {/* Status Icon */}
      <div className={`shrink-0 text-lg ${cfg.pulse ? 'animate-pulse' : ''}`}>
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-gray-200 truncate">{job.recipientEmail}</span>
          <StatusBadge status={job.status} />
        </div>

        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {job.estimatedSendTime && (
            <span className="text-xs text-gray-500">
              Est: {formatTimeOnly(job.estimatedSendTime)}
            </span>
          )}
          {job.actualSentTime && (
            <span className="text-xs text-emerald-500">
              Sent: {formatTimeOnly(job.actualSentTime)}
            </span>
          )}
          {job.status === 'retrying' && job.nextRetryAt && (
            <span className="text-xs text-orange-400">
              Retry in {formatRelativeTime(job.nextRetryAt)}
            </span>
          )}
          {job.retryCount > 0 && (
            <span className="text-xs text-gray-600">
              Retry #{job.retryCount}
            </span>
          )}
        </div>

        {job.errorMessage && job.status !== 'sent' && (
          <p className="text-xs text-red-400 mt-1 truncate">{job.errorMessage}</p>
        )}

        {job.previewUrl && (
          <a
            href={job.previewUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 inline-flex items-center gap-1"
          >
            View in Ethereal
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>

      {/* Time column */}
      <div className="shrink-0 text-right">
        <div className="text-xs text-gray-500 tabular-nums">
          {formatTimeOnly(job.estimatedSendTime || job.createdAt)}
        </div>
      </div>
    </div>
  );
}

function RateLimitWall() {
  return (
    <div className="flex items-center gap-3 py-3 px-4 my-2 rounded-xl bg-orange-500/5 border border-orange-500/20 border-dashed">
      <span className="text-lg">🔒</span>
      <div>
        <p className="text-sm font-medium text-orange-400">Rate Limit Reached</p>
        <p className="text-xs text-gray-500">Emails below were automatically rescheduled to the next available hour window</p>
      </div>
    </div>
  );
}

interface TimelineViewProps {
  campaignId?: string;
}

export default function TimelineView({ campaignId }: TimelineViewProps) {
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [newJobIds, setNewJobIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 50;

  const fetchJobs = useCallback(async (p: number = 1) => {
    try {
      setLoading(true);
      const data = await jobsApi.list({
        ...(campaignId ? { campaignId } : {}),
        page: p,
        limit: LIMIT,
      });
      setJobs(data.jobs);
      setTotalPages(data.pagination.pages);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchJobs(page);
  }, [fetchJobs, page]);

  // Subscribe to SSE for real-time updates
  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/events`, { withCredentials: true });

    const handleStatusUpdate = (event: MessageEvent) => {
      try {
        const data: SseJobStatusEvent = JSON.parse(event.data);

        if (campaignId && data.campaignId !== campaignId) return;

        // Mark as "new" for animation
        setNewJobIds((prev) => new Set([...prev, data.jobId]));
        setTimeout(() => {
          setNewJobIds((prev) => {
            const next = new Set(prev);
            next.delete(data.jobId);
            return next;
          });
        }, 2000);

        // Update job status in-place
        setJobs((prev) =>
          prev.map((j) => {
            if (j.id === data.jobId) {
              return {
                ...j,
                status: data.status,
                ...(data.newEstimatedTime ? { estimatedSendTime: data.newEstimatedTime } : {}),
                ...(data.nextRetryAt ? { nextRetryAt: data.nextRetryAt, retryCount: data.retryCount ?? j.retryCount } : {}),
              };
            }
            return j;
          })
        );
      } catch {
        // ignore parse errors
      }
    };

    const handleSent = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (campaignId && data.campaignId !== campaignId) return;

        setJobs((prev) =>
          prev.map((j) =>
            j.id === data.jobId
              ? { ...j, status: 'sent' as EmailJobStatus, actualSentTime: data.sentAt, previewUrl: data.previewUrl }
              : j
          )
        );
      } catch {}
    };

    es.addEventListener('job:sending', handleStatusUpdate);
    es.addEventListener('job:rescheduled', handleStatusUpdate);
    es.addEventListener('job:retrying', handleStatusUpdate);
    es.addEventListener('job:failed', handleStatusUpdate);
    es.addEventListener('job:sent', handleSent);
    es.addEventListener('campaign:created', () => fetchJobs(1));

    return () => es.close();
  }, [campaignId, fetchJobs]);

  const groupedJobs = groupJobsByHour(
    [...jobs].sort((a, b) =>
      new Date(a.estimatedSendTime ?? a.createdAt).getTime() -
      new Date(b.estimatedSendTime ?? b.createdAt).getTime()
    )
  );

  if (loading && jobs.length === 0) {
    return <TableSkeleton rows={6} />;
  }

  if (!loading && jobs.length === 0) {
    return (
      <EmptyState
        icon="📭"
        title="No emails yet"
        description="Schedule a new campaign to see emails appear here in real time."
      />
    );
  }

  return (
    <div className="space-y-6">
      {groupedJobs.map((group, gi) => (
        <div key={group.hourLabel} className="animate-fade-in-up" style={{ animationDelay: `${gi * 0.05}s` }}>
          {/* Rate-limit wall indicator */}
          {group.isRateLimitWall && <RateLimitWall />}

          {/* Hour header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-400" />
              <span className="text-sm font-semibold text-indigo-300">{group.hourLabel}</span>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-indigo-500/30 to-transparent" />
            <span className="text-xs text-gray-600">{group.jobs.length} emails</span>
          </div>

          {/* Jobs in this hour */}
          <div className="space-y-2 pl-4 timeline-line">
            {group.jobs.map((job) => (
              <TimelineItem
                key={job.id}
                job={job}
                isNew={newJobIds.has(job.id)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm glass rounded-lg border border-gray-700 disabled:opacity-40 hover:bg-gray-800 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-400">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-sm glass rounded-lg border border-gray-700 disabled:opacity-40 hover:bg-gray-800 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
