/**
 * API helper — thin wrapper over fetch.
 * Basic-auth credentials are injected by the Vite proxy in dev,
 * or by Express basicAuth in production (cookie/session).
 */

const API_BASE = '/admin-api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_BEARER_TOKEN_HERE',
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

export interface ClientStat {
  client_id: number;
  client_name: string;
  rcs_sent: number;
  sms_fallback: number;
  failed: number;
  dlrs_received: number;
  total: number;
  fallback_rate: number;
}

export interface MetricsResponse {
  stats: {
    total_received: number;
    rcs_sent: number;
    sms_fallback: number;
    dlrs_received: number;
    terminal_failures: number;
  };
  clients: ClientStat[];
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
  getMetrics: (dateFrom?: string, dateTo?: string) => {
    let qs = '';
    if (dateFrom && dateTo) qs = `?dateFrom=${dateFrom}&dateTo=${dateTo}`;
    else if (dateFrom) qs = `?dateFrom=${dateFrom}`;
    return request<MetricsResponse>(`/stats/overview${qs}`);
  },

  getLogs: (limit = 30, offset = 0, clientId?: number, status?: string, channel?: string) => {
    let qs = `?limit=${limit}&offset=${offset}`;
    if (clientId) qs += `&clientId=${clientId}`;
    if (status) qs += `&status=${status}`;
    if (channel) qs += `&channel=${channel}`;
    return request<LogsResponse>(`/messages${qs}`);
  },

  getMessageDetail: (id: number) =>
    request<MessageDetailResponse>(`/messages/${id}`),

  getDlrEvents: (limit = 30, offset = 0, clientId?: number, state?: string) => {
    let qs = `?limit=${limit}&offset=${offset}`;
    if (clientId) qs += `&clientId=${clientId}`;
    if (state) qs += `&state=${state}`;
    return request<DlrEventsResponse>(`/dlr${qs}`);
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
    request<{ status: string }>(`/clients/${id}/status`, {
      method: 'PATCH',
    }),
};
