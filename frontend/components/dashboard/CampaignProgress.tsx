'use client';

import { Campaign } from '@/types';

interface CampaignProgressProps {
  campaign: Campaign;
  compact?: boolean;
}

export default function CampaignProgress({ campaign, compact = false }: CampaignProgressProps) {
  const { sentCount, failedCount, totalRecipients } = campaign;
  const processed = sentCount + failedCount;
  const progressPct = totalRecipients > 0 ? Math.round((processed / totalRecipients) * 100) : 0;
  const sentPct = totalRecipients > 0 ? (sentCount / totalRecipients) * 100 : 0;
  const failPct = totalRecipients > 0 ? (failedCount / totalRecipients) * 100 : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full progress-bar-animated rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 tabular-nums w-8 text-right">{progressPct}%</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Campaign Progress</span>
        <span className="text-sm font-semibold text-white tabular-nums">{progressPct}%</span>
      </div>

      {/* Stacked progress bar */}
      <div className="h-3 bg-gray-800 rounded-full overflow-hidden flex">
        {/* Sent (green) */}
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
          style={{ width: `${sentPct}%` }}
        />
        {/* Failed (red) */}
        <div
          className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-all duration-700"
          style={{ width: `${failPct}%` }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {sentCount} sent
          </span>
          {failedCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              {failedCount} failed
            </span>
          )}
        </div>
        <span className="text-gray-600">{processed} / {totalRecipients}</span>
      </div>
    </div>
  );
}
