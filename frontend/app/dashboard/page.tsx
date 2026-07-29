'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import LiveStatsBanner from '@/components/dashboard/LiveStatsBanner';
import CampaignsTable from '@/components/dashboard/CampaignsTable';
import SentEmailsTable from '@/components/dashboard/SentEmailsTable';
import TimelineView from '@/components/timeline/TimelineView';
import ComposeModal from '@/components/compose/ComposeModal';
import ToastContainer from '@/components/ui/Toast';
import { Campaign } from '@/types';

type Tab = 'timeline' | 'campaigns' | 'sent';

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('timeline');
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    authApi.me()
      .then(() => setAuthChecked(true))
      .catch(() => router.push('/'));
  }, [router]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string; desc: string }[] = [
    { id: 'timeline', label: 'Live Timeline', icon: '📡', desc: 'Real-time email status feed' },
    { id: 'campaigns', label: 'Campaigns', icon: '📊', desc: 'All campaigns' },
    { id: 'sent', label: 'Sent Emails', icon: '✅', desc: 'Delivered emails' },
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-[120px]" />
      </div>

      <DashboardHeader onCompose={() => setComposeOpen(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats Banner */}
        <LiveStatsBanner />

        {/* Campaign detail panel */}
        {selectedCampaign && (
          <div className="glass rounded-2xl border border-indigo-500/20 p-6 animate-scale-in">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">{selectedCampaign.subject}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Campaign • {selectedCampaign.totalRecipients} recipients • {selectedCampaign.sentCount} sent
                </p>
              </div>
              <button
                onClick={() => setSelectedCampaign(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >✕</button>
            </div>
            <TimelineView campaignId={selectedCampaign.id} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-900/50 border border-gray-800/50 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab description */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {tabs.find((t) => t.id === activeTab)?.desc}
          {activeTab === 'timeline' && (
            <span className="flex items-center gap-1 text-xs text-emerald-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          )}
        </div>

        {/* Tab content */}
        <div className="animate-fade-in-up" key={activeTab}>
          {activeTab === 'timeline' && <TimelineView />}
          {activeTab === 'campaigns' && (
            <CampaignsTable
              refreshTrigger={refreshCount}
              onSelect={(c) => {
                setSelectedCampaign(c);
                setActiveTab('timeline');
              }}
            />
          )}
          {activeTab === 'sent' && <SentEmailsTable />}
        </div>
      </main>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSuccess={() => {
          setRefreshCount((n) => n + 1);
          setActiveTab('timeline');
        }}
      />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}
