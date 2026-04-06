/**
 * API helper — thin wrapper over fetch.
 * Basic-auth credentials are injected by the Vite proxy in dev,
 * or by Express basicAuth in production (cookie/session).
 */

const API_BASE = '/api/dashboard';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

/* ── Typed API calls ──────────────────────────────────────────── */

export interface MessageLog {
  id: number;
  callback_data: string;
  client_id: number;
  client_name?: string;
  destination: string;
  bot_id: string;
  template_name: string | null;
  message_type: string;
  fallback_order: string;
  status: string;
  sparc_message_id: string | null;
  raw_payload: unknown;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface DlrEvent {
  id: number;
  callback_data: string;
  sparc_status: string;
  moe_status: string;
  error_message: string | null;
  event_timestamp: number | null;
  callback_dispatched: number;
  destination?: string;
  message_type?: string;
  client_name?: string;
  created_at: string;
}

export interface Client {
  id: number;
  client_name: string;
  bearer_token: string;
  rcs_username: string | null;
  rcs_password: string | null;
  sms_username: string | null;
  sms_password: string | null;
  rcs_assistant_id: string | null;
  is_active: number;
  created_at: string;
}

export interface MetricsResponse {
  stats: Record<string, number>;
  timeline: Array<{ hour: string; status: string; count: number }>;
  channelStats: { RCS: number; SMS: number };
}

export interface LogsResponse {
  logs: MessageLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface DlrEventsResponse {
  events: DlrEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface MessageDetailResponse {
  message: MessageLog;
  dlrEvents: DlrEvent[];
}

/* ── Exported API functions ───────────────────────────────────── */

export const api = {
  getMetrics: () => request<MetricsResponse>('/metrics'),

  getLogs: (limit = 30, offset = 0, clientId?: number) => {
    let qs = `?limit=${limit}&offset=${offset}`;
    if (clientId) qs += `&client_id=${clientId}`;
    return request<LogsResponse>(`/logs${qs}`);
  },

  getMessageDetail: (id: number) =>
    request<MessageDetailResponse>(`/messages/${id}`),

  getDlrEvents: (limit = 30, offset = 0, clientId?: number) => {
    let qs = `?limit=${limit}&offset=${offset}`;
    if (clientId) qs += `&client_id=${clientId}`;
    return request<DlrEventsResponse>(`/dlr-events${qs}`);
  },

  getClients: () => request<{ clients: Client[] }>('/clients'),

  onboardClient: (data: Record<string, string>) =>
    request<{ status: string; client: Client }>('/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateClient: (id: number, data: Record<string, string>) =>
    request<{ status: string; client: Client }>(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deactivateClient: (id: number) =>
    request<{ status: string }>(`/clients/${id}`, {
      method: 'DELETE',
    }),
};
