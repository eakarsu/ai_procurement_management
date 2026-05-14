const API_BASE = (import.meta as any).env?.VITE_API_BASE || '/api';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      detail = data?.detail || JSON.stringify(data) || detail;
    } catch {
      detail = await res.text() || detail;
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as any;
  return res.json();
}

// ── Auth ──
export const auth = {
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, name: string) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  me: () => request('/auth/me'),
};

// ── Workflows ──
export const workflows = {
  list: (page = 1, page_size = 20, params: { search?: string; status?: string; trigger_type?: string } = {}) => {
    const q = new URLSearchParams({ page: String(page), page_size: String(page_size) });
    if (params.search) q.set('search', params.search);
    if (params.status) q.set('status', params.status);
    if (params.trigger_type) q.set('trigger_type', params.trigger_type);
    return request(`/workflows?${q.toString()}`);
  },
  get: (id: string) => request(`/workflows/${id}`),
  create: (data: any) => request('/workflows', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request(`/workflows/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setStatus: (id: string, new_status: string) =>
    request(`/workflows/${id}/status?new_status=${encodeURIComponent(new_status)}`, { method: 'PATCH' }),
  remove: (id: string) => request(`/workflows/${id}`, { method: 'DELETE' }),
  execute: (id: string, input_data: any = {}) =>
    request(`/workflows/${id}/execute`, { method: 'POST', body: JSON.stringify({ input_data }) }),
  runs: (id: string, page = 1, page_size = 20) =>
    request(`/workflows/${id}/runs?page=${page}&page_size=${page_size}`),
  getRun: (workflow_id: string, run_id: string) =>
    request(`/workflows/${workflow_id}/runs/${run_id}`),
  retryRun: (workflow_id: string, run_id: string) =>
    request(`/workflows/${workflow_id}/runs/${run_id}/retry`, { method: 'POST' }),
  versions: (id: string) => request(`/workflows/${id}/versions`),
  restoreVersion: (id: string, version_number: number) =>
    request(`/workflows/${id}/versions/${version_number}/restore`, { method: 'POST' }),
};

// ── Tasks ──
export const tasks = {
  list: (params: { status?: string; priority?: string; search?: string; page?: number; page_size?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.priority) q.set('priority', params.priority);
    if (params.search) q.set('search', params.search);
    if (params.page) q.set('page', String(params.page));
    if (params.page_size) q.set('page_size', String(params.page_size));
    return request(`/tasks${q.toString() ? '?' + q.toString() : ''}`);
  },
  get: (id: string) => request(`/tasks/${id}`),
  create: (data: any) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => request(`/tasks/${id}`, { method: 'DELETE' }),
  bulkUpdate: (task_ids: string[], updates: { status?: string; priority?: string; assigned_to?: string }) =>
    request('/tasks/bulk-update', { method: 'POST', body: JSON.stringify({ task_ids, ...updates }) }),
  bulkDelete: (task_ids: string[]) =>
    request('/tasks/bulk-delete', { method: 'DELETE', body: JSON.stringify({ task_ids }) }),
};

// ── Automations ──
export const automations = {
  list: (params: { page?: number; is_active?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.is_active !== undefined) q.set('is_active', String(params.is_active));
    return request(`/automations${q.toString() ? '?' + q.toString() : ''}`);
  },
  get: (id: string) => request(`/automations/${id}`),
  create: (data: any) => request('/automations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request(`/automations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => request(`/automations/${id}`, { method: 'DELETE' }),
  toggle: (id: string) => request(`/automations/${id}/toggle`, { method: 'PATCH' }),
  test: (id: string, test_data: any) =>
    request(`/automations/${id}/test`, { method: 'POST', body: JSON.stringify({ test_data }) }),
  logs: (id: string, page = 1) => request(`/automations/${id}/logs?page=${page}`),
};

// ── AI ──
export const ai = {
  analyzeProcess: (process_description: string, goals: string[] = []) =>
    request('/ai/analyze-process', {
      method: 'POST',
      body: JSON.stringify({ process_description, goals }),
    }),
  generateWorkflow: (business_goal: string, constraints: string[] = []) =>
    request('/ai/generate-workflow', {
      method: 'POST',
      body: JSON.stringify({ business_goal, constraints }),
    }),
  optimizeWorkflow: (workflow_id: string) =>
    request(`/ai/optimize-workflow/${workflow_id}`, { method: 'POST' }),
  prioritizeTasks: (context = '') =>
    request('/ai/prioritize-tasks', { method: 'POST', body: JSON.stringify({ context }) }),
  summarizeRuns: (workflow_id: string) =>
    request(`/ai/summarize-runs/${workflow_id}`),
  detectAnomalies: (workflow_id: string) =>
    request(`/ai/detect-anomalies/${workflow_id}`),
  suggestAutomationRules: () =>
    request('/ai/suggest-automation-rules', { method: 'POST' }),
  // Apply pass 5
  processMining: (workflow_id: string) =>
    request(`/ai/process-mining/${workflow_id}`, { method: 'POST' }),
  refineWorkflow: (data: { user_message: string; previous_steps?: any[]; history?: any[] }) =>
    request('/ai/refine-workflow', { method: 'POST', body: JSON.stringify(data) }),
  rpaStatus: () => request('/ai/rpa/status'),
  rpaDispatch: (provider: string, payload: any) =>
    request(`/ai/rpa/${provider}/dispatch`, { method: 'POST', body: JSON.stringify(payload) }),
  history: (params: { page?: number; analysis_type?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.analysis_type) q.set('analysis_type', params.analysis_type);
    return request(`/ai/history${q.toString() ? '?' + q.toString() : ''}`);
  },
  getAnalysis: (id: string) => request(`/ai/history/${id}`),
  streamAnalysisURL: (process: string) => {
    const token = localStorage.getItem('token');
    const url = new URL(`${window.location.origin}${API_BASE}/ai/stream-analysis`);
    url.searchParams.set('process', process);
    return { url: url.toString(), token };
  },
};

// ── Analytics ──
export const analytics = {
  get: () => request('/analytics'),
};

// ── Apply pass 5 — extras (task dependencies + approvals) ──
export const extras = {
  taskDeps: {
    list: (task_id?: string) => request(`/extras/task-dependencies${task_id ? `?task_id=${encodeURIComponent(task_id)}` : ''}`),
    add: (task_id: string, depends_on_task_id: string) =>
      request('/extras/task-dependencies', { method: 'POST', body: JSON.stringify({ task_id, depends_on_task_id }) }),
    remove: (id: number) => request(`/extras/task-dependencies/${id}`, { method: 'DELETE' }),
  },
  approvals: {
    list: (status?: string) => request(`/extras/approvals${status ? `?status=${encodeURIComponent(status)}` : ''}`),
    create: (data: { subject: string; workflow_run_id?: string; approver_id?: string; payload?: any }) =>
      request('/extras/approvals', { method: 'POST', body: JSON.stringify(data) }),
    decide: (id: number, decision: 'approved' | 'rejected', decision_note?: string) =>
      request(`/extras/approvals/${id}/decide`, { method: 'POST', body: JSON.stringify({ decision, decision_note }) }),
  },
};

// ── Templates ──
export const templates = {
  list: (category?: string) =>
    request(`/templates${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  get: (id: string) => request(`/templates/${id}`),
  instantiate: (id: string) => request(`/templates/${id}/instantiate`, { method: 'POST' }),
};
