'use client';

import { useEffect, useState, useCallback } from 'react';
import { Campaign } from '@/types';
import { campaignsApi } from '@/lib/api';
import { formatDateTime, CAMPAIGN_STATUS_CONFIG } from '@/lib/utils';
import { TableSkeleton, EmptyState } from '@/components/ui/Skeleton';
import CampaignProgress from '@/components/dashboard/CampaignProgress';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface CampaignsTableProps {
  onSelect?: (campaign: Campaign) => void;
  refreshTrigger?: number;
}

export default function CampaignsTable({ onSelect, refreshTrigger }: CampaignsTableProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchCampaigns = useCallback(async (p: number = 1) => {
    try {
      setLoading(true);
      const data = await campaignsApi.list({ page: p, limit: 15 });
      setCampaigns(data.campaigns);
      setTotalPages(data.pagination.pages);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(page); }, [fetchCampaigns, page, refreshTrigger]);

  // SSE: refresh on campaign events
  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/events`, { withCredentials: true });
    es.addEventListener('campaign:created', () => fetchCampaigns(1));
    es.addEventListener('campaign:completed', () => fetchCampaigns(page));
    return () => es.close();
  }, [fetchCampaigns, page]);

  if (loading) return <TableSkeleton rows={5} />;

  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon="📬"
        title="No campaigns yet"
        description="Create your first email campaign to get started."
      />
    );
  }

  return (
    <div className="space-y-4">
      {campaigns.map((c, i) => {
        const statusCfg = CAMPAIGN_STATUS_CONFIG[c.status];
        return (
          <div
            key={c.id}
            className="p-4 rounded-xl glass border border-gray-800/50 glass-hover cursor-pointer animate-fade-in-up"
            style={{ animationDelay: `${i * 0.06}s` }}
            onClick={() => onSelect?.(c)}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-100 truncate">{c.subject}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {c.sender?.name} • {formatDateTime(c.scheduledAt)}
                </p>
              </div>
              <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border ${statusCfg.bg} ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            </div>

            <CampaignProgress campaign={c} compact />

            <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
              <span>👥 {c.totalRecipients} recipients</span>
              <span>⚡ {c.hourlyLimit}/hr limit</span>
              <span>⏱ {c.delayBetweenEmailsMs / 1000}s delay</span>
            </div>
          </div>
        );
      })}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm glass rounded-lg border border-gray-700 disabled:opacity-40 hover:bg-gray-800 transition-colors"
          >← Prev</button>
          <span className="text-sm text-gray-400">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm glass rounded-lg border border-gray-700 disabled:opacity-40 hover:bg-gray-800 transition-colors"
          >Next →</button>
        </div>
      )}
    </div>
  );
}
