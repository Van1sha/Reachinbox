'use client';

import { useEffect, useState, useRef } from 'react';
import { Campaign, SseCampaignEvent } from '@/types';
import { statsApi } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Stat {
  label: string;
  value: number | string;
  icon: string;
  color: string;
  sub?: string;
}

export default function LiveStatsBanner() {
  const [stats, setStats] = useState<Stat[]>([
    { label: 'Total Sent', value: '—', icon: '✅', color: 'text-emerald-400', sub: 'emails' },
    { label: 'Scheduled', value: '—', icon: '📅', color: 'text-purple-400', sub: 'emails' },
    { label: 'In Queue', value: '—', icon: '⏳', color: 'text-yellow-400', sub: 'jobs' },
    { label: 'Campaigns', value: '—', icon: '📊', color: 'text-blue-400', sub: 'total' },
  ]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = async () => {
    try {
      const data = await statsApi.get();
      setStats([
        { label: 'Total Sent', value: data.emails.sent, icon: '✅', color: 'text-emerald-400', sub: 'emails' },
        { label: 'Scheduled', value: data.emails.scheduled, icon: '📅', color: 'text-purple-400', sub: 'emails' },
        { label: 'In Queue', value: data.queue.waiting + data.queue.active + data.queue.delayed, icon: '⏳', color: 'text-yellow-400', sub: 'jobs' },
        { label: 'Campaigns', value: data.campaigns.total, icon: '📊', color: 'text-blue-400', sub: 'total' },
      ]);
      setLastUpdated(new Date());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Listen to SSE events to trigger stat refresh
    const es = new EventSource(`${API_BASE}/api/events`, { withCredentials: true });
    es.addEventListener('job:sent', () => fetchStats());
    es.addEventListener('campaign:created', () => fetchStats());
    es.addEventListener('campaign:completed', () => fetchStats());

    return () => es.close();
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className="glass rounded-xl p-4 border border-gray-800/50 glass-hover animate-fade-in-up"
          style={{ animationDelay: `${i * 0.08}s` }}
        >
          <div className="flex items-start justify-between mb-3">
            <span className="text-xl">{stat.icon}</span>
            {loading ? (
              <div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-xs text-gray-600">{stat.sub}</span>
            )}
          </div>
          <div className={`text-2xl font-bold ${stat.color} mb-1 tabular-nums`}>
            {loading ? '—' : stat.value.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">{stat.label}</div>
        </div>
      ))}
      {lastUpdated && (
        <div className="col-span-full text-right">
          <span className="text-xs text-gray-600">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
}
