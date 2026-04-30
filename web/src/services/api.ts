import type { Health, ProxyNode, Connection, Subscription, Provider, Rule, TunDiagnostics, TunConfig } from '../types';

const API_BASE = '';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseErrorText(text) || `HTTP ${res.status}`);
  }
  return res.json();
}

function parseErrorText(text: string): string {
  if (!text.trim()) return '';
  try {
    const data = JSON.parse(text) as { error?: string; message?: string };
    return data.error || data.message || text;
  } catch {
    return text;
  }
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  
  post: <T>(url: string, data?: unknown) => request<T>(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined
  }),
  
  patch: <T>(url: string, data?: unknown) => request<T>(url, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined
  }),
  
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
  
  put: <T>(url: string, data?: unknown) => request<T>(url, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined
  })
};

export const healthApi = {
  get: () => api.get<Health>('/api/health')
};

export const proxiesApi = {
  getAll: () => api.get<{ proxies: Record<string, ProxyNode> }>('/api/mihomo/proxies'),
  
  select: (group: string, proxy: string) => api.put(`/api/mihomo/proxies/${encodeURIComponent(group)}`, { name: proxy }),
  
  testDelay: (proxy: string, url?: string) => 
    api.get<{ delay: number }>(`/api/mihomo/proxies/${encodeURIComponent(proxy)}/delay?timeout=5000&url=${encodeURIComponent(url || 'https://www.gstatic.com/generate_204')}`)
};

export const connectionsApi = {
  getAll: () => api.get<{ connections: Connection[] }>('/api/mihomo/connections'),
  
  close: (id: string) => api.delete(`/api/mihomo/connections/${encodeURIComponent(id)}`),
  
  closeAll: () => api.delete('/api/mihomo/connections')
};

export const subscriptionsApi = {
  getAll: () => api.get<Subscription[]>('/api/subscriptions'),
  
  add: (name: string, url: string) => api.post('/api/subscriptions', { name, url }),
  
  update: (name: string, url: string) => api.patch(`/api/subscriptions/${encodeURIComponent(name)}`, { url }),
  
  delete: (name: string) => api.delete(`/api/subscriptions/${encodeURIComponent(name)}`),
  
  refresh: (name: string) => api.post(`/api/subscriptions/${encodeURIComponent(name)}/refresh`)
};

export const providersApi = {
  getAll: () => api.get<Provider[]>('/api/mihomo/providers/proxies'),
  
  refresh: (name: string) => api.put(`/api/mihomo/providers/proxies/${encodeURIComponent(name)}`)
};

export const rulesApi = {
  getAll: () => api.get<{ rules: Rule[] }>('/api/mihomo/rules')
};

export const configApi = {
  get: () => api.get<RuntimeConfig>('/api/config'),
  
  patch: (data: Partial<RuntimeConfig>) => api.patch('/api/config', data),
  
  reload: () => api.post('/api/config/reload'),
  
  getTunDiagnostics: () => api.get<TunDiagnostics>('/api/config/tun/diagnostics'),
  
  patchTun: (config: Partial<TunConfig>) => api.patch('/api/config/tun', config),
  
  testTun: () => api.post('/api/config/tun/test')
};

export const serviceApi = {
  restart: () => api.post('/api/service/restart'),
  
  status: () => api.get<{ running: boolean }>('/api/service/status')
};

type RuntimeConfig = {
  mode?: string;
  logLevel?: string;
  ipv6?: boolean;
  tun?: TunConfig;
  dns?: {
    enable?: boolean;
    listen?: string;
    enhancedMode?: string;
    nameserver?: string[];
    fallback?: string[];
  };
};

export type { RuntimeConfig };
