'use client';

import React from 'react';
import { EmailJobStatus } from '@/types';
import { STATUS_CONFIG } from '@/lib/utils';

interface StatusBadgeProps {
  status: EmailJobStatus;
  showDot?: boolean;
  animate?: boolean;
}

export default function StatusBadge({ status, showDot = true, animate = true }: StatusBadgeProps) {
  const config = (status && STATUS_CONFIG[status]) || STATUS_CONFIG.scheduled;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.color}`}>
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${config.dot} ${animate && (status === 'sending' || status === 'retrying') ? 'animate-pulse' : ''}`}
        />
      )}
      {config.label}
    </span>
  );
}
