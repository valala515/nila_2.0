import type { ConversationsFilter, ConversationsPage, ConversationSummary, DashboardMetrics, TranscriptEntry } from './types';

const TOKEN_STORAGE_KEY = 'nila_dashboard_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export class UnauthorizedError extends Error {}

export async function fetchDashboardMetrics(token: string, sinceDays: number): Promise<DashboardMetrics> {
  const response = await fetch(`/api/dashboard-metrics?sinceDays=${sinceDays}`, {
    headers: { authorization: `Bearer ${token}` },
  });

  if (response.status === 401) throw new UnauthorizedError('Invalid dashboard token');
  if (!response.ok) throw new Error(`Dashboard API error: ${response.status}`);

  return (await response.json()) as DashboardMetrics;
}

async function postUserAction(path: string, token: string, userId: string): Promise<void> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ userId }),
  });

  if (response.status === 401) throw new UnauthorizedError('Invalid dashboard token');
  if (!response.ok) throw new Error(`Dashboard API error: ${response.status}`);
}

export function resetUserSession(token: string, userId: string): Promise<void> {
  return postUserAction('/api/users/reset', token, userId);
}

export function deleteUserHistory(token: string, userId: string): Promise<void> {
  return postUserAction('/api/users/delete', token, userId);
}

function buildConversationsQuery(filter: ConversationsFilter, extra: Record<string, string>): string {
  const params = new URLSearchParams(extra);
  if (filter.userId) params.set('userId', filter.userId);
  if (filter.reachedPhase) params.set('reachedPhase', filter.reachedPhase);
  if (filter.completed !== undefined) params.set('completed', String(filter.completed));
  return params.toString();
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (response.status === 401) throw new UnauthorizedError('Invalid dashboard token');
  if (!response.ok) throw new Error(`Dashboard API error: ${response.status}`);
  return (await response.json()) as T;
}

export function fetchConversations(
  token: string,
  filter: ConversationsFilter,
  cursor: number | null,
  limit: number,
): Promise<ConversationsPage> {
  const extra: Record<string, string> = { limit: String(limit) };
  if (cursor !== null) extra.cursor = String(cursor);
  return fetchJson(`/api/conversations?${buildConversationsQuery(filter, extra)}`, token);
}

export async function fetchTranscript(token: string, sessionId: number): Promise<TranscriptEntry[]> {
  const body = await fetchJson<{ transcript: TranscriptEntry[] }>(`/api/conversations/${sessionId}/transcript`, token);
  return body.transcript;
}

export interface ConversationsExport {
  truncated: boolean;
  conversations: Array<{ session: ConversationSummary; transcript: TranscriptEntry[] }>;
}

export function fetchConversationsExport(token: string, filter: ConversationsFilter): Promise<ConversationsExport> {
  return fetchJson(`/api/conversations/export?${buildConversationsQuery(filter, {})}`, token);
}
