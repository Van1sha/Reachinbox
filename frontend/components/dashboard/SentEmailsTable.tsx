'use client';

import { useEffect, useState, useCallback } from 'react';
import { EmailJob } from '@/types';
import { jobsApi } from '@/lib/api';
import { formatDateTime, formatRelativeTime } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';
import { TableSkeleton, EmptyState } from '@/components/ui/Skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface SentEmailsTableProps {
  campaignId?: string;
}

export default function SentEmailsTable({ campaignId }: SentEmailsTableProps) {
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchJobs = useCallback(async (p: number = 1) => {
    try {
      setLoading(true);
      const data = await jobsApi.list({
        status: 'sent',
        ...(campaignId ? { campaignId } : {}),
        page: p,
        limit: 20,
      });
      setJobs(data.jobs);
      setTotalPages(data.pagination.pages);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { fetchJobs(page); }, [fetchJobs, page]);

  // SSE: update when a job is sent
  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/events`, { withCredentials: true });
    es.addEventListener('job:sent', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (campaignId && data.campaignId !== campaignId) return;
        // Refresh the table when a new email is sent
        fetchJobs(1);
      } catch {}
    });
    return () => es.close();
  }, [campaignId, fetchJobs]);

  if (loading && jobs.length === 0) return <TableSkeleton rows={5} />;

  if (!loading && jobs.length === 0) {
    return (
      <EmptyState
        icon="📭"
        title="No sent emails yet"
        description="Sent emails will appear here once campaigns start processing."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_200px_160px_100px] gap-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        <span>Recipient</span>
        <span>Subject</span>
        <span>Sent At</span>
        <span>Status</span>
      </div>

      {jobs.map((job, i) => (
        <div
          key={job.id}
          className="grid grid-cols-[1fr_200px_160px_100px] gap-4 items-center p-4 rounded-xl glass border border-gray-800/50 glass-hover animate-fade-in-up"
          style={{ animationDelay: `${i * 0.04}s` }}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate">{job.recipientEmail}</p>
            {job.previewUrl && (
              <a
                href={job.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-400 hover:underline"
              >
                View email ↗
              </a>
            )}
          </div>
          <p className="text-sm text-gray-400 truncate">{job.campaign?.subject}</p>
          <div>
            <p className="text-sm text-gray-300">{formatDateTime(job.actualSentTime)}</p>
            <p className="text-xs text-gray-600">{formatRelativeTime(job.actualSentTime)}</p>
          </div>
          <StatusBadge status={job.status} />
        </div>
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm glass rounded-lg border border-gray-700 disabled:opacity-40 hover:bg-gray-800 transition-colors">← Prev</button>
          <span className="text-sm text-gray-400">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-sm glass rounded-lg border border-gray-700 disabled:opacity-40 hover:bg-gray-800 transition-colors">Next →</button>
        </div>
      )}
    </div>
  );
}
