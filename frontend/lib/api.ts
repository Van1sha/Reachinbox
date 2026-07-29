import {
  Campaign,
  CampaignsResponse,
  EmailJob,
  JobsResponse,
  Sender,
  Stats,
  AdaptivePlanPreview,
  User,
  ComposeFormData,
} from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(res.status, body.error || res.statusText);
  }

  return res.json();
}

// Auth
export const authApi = {
  me: () => fetchApi<{ user: User }>('/api/auth/me'),
  logout: () => fetchApi<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
  devLogin: () => fetchApi<{ user: User }>('/api/auth/dev-login', { method: 'POST' }),
  googleLoginUrl: () => `${API_BASE}/api/auth/google`,
};

// Campaigns
export const campaignsApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
    ).toString();
    return fetchApi<CampaignsResponse>(`/api/campaigns${query ? `?${query}` : ''}`);
  },
  get: (id: string) => fetchApi<{ campaign: Campaign }>(`/api/campaigns/${id}`),
  create: (data: ComposeFormData) =>
    fetchApi<{ campaign: Campaign }>('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  preview: (params: {
    senderId: string;
    hourlyLimit: number;
    totalEmails: number;
    startTime: string;
    delayBetweenEmailsMs: number;
  }) =>
    fetchApi<{ plan: AdaptivePlanPreview }>('/api/campaigns/preview', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};

// Jobs
export const jobsApi = {
  list: (params?: { campaignId?: string; status?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
    ).toString();
    return fetchApi<JobsResponse>(`/api/jobs${query ? `?${query}` : ''}`);
  },
  get: (id: string) => fetchApi<{ job: EmailJob }>(`/api/jobs/${id}`),
};

// Senders
export const sendersApi = {
  list: () => fetchApi<{ senders: Sender[] }>('/api/senders'),
  create: (data: any) =>
    fetchApi<{ sender: Sender }>('/api/senders', { method: 'POST', body: JSON.stringify(data) }),
  seed: () => fetchApi<{ senders: Sender[] }>('/api/senders/seed', { method: 'POST' }),
};

// Stats
export const statsApi = {
  get: () => fetchApi<Stats>('/api/stats'),
};

export { ApiError };
