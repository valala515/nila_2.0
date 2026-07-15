import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { getDashboardMetrics } from '../application/useCases/getDashboardMetrics.js';
import { resetUserSession, deleteUserHistory, type ManageUserHistoryDeps } from '../application/useCases/manageUserHistory.js';
import { matchesConversationsRoute, handleConversationsRoute } from './conversationsApi.js';
import type { AnalyticsQueryPort } from '../application/ports/analyticsQueryPort.js';
import type { ConversationsQueryPort } from '../application/ports/conversationsQueryPort.js';

export interface DashboardApiDeps {
  analyticsQuery: AnalyticsQueryPort;
  conversationsQuery: ConversationsQueryPort;
  userHistory: ManageUserHistoryDeps;
  token: string;
  staticDir: string;
}

const DEFAULT_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function isAuthorized(req: IncomingMessage, token: string): boolean {
  return req.headers.authorization === `Bearer ${token}`;
}

function sinceIsoFromQuery(url: URL): string {
  const days = Number(url.searchParams.get('sinceDays')) || DEFAULT_WINDOW_DAYS;
  return new Date(Date.now() - days * MS_PER_DAY).toISOString();
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function handleMetrics(req: IncomingMessage, res: ServerResponse, url: URL, deps: DashboardApiDeps): Promise<void> {
  if (!isAuthorized(req, deps.token)) {
    sendJson(res, 401, { error: 'unauthorized' });
    return;
  }
  const metrics = await getDashboardMetrics(sinceIsoFromQuery(url), deps.analyticsQuery);
  sendJson(res, 200, metrics);
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

function extractUserId(body: Record<string, unknown>): string | null {
  const userId = body.userId;
  return typeof userId === 'string' && userId.trim().length > 0 ? userId.trim() : null;
}

/**
 * SPEC: handleUserHistoryAction
 * Назначение: общий обработчик для reset/delete по userId из тела запроса —
 *   оба маршрута одинаковы по форме (auth → parse body → одно действие),
 *   различается только сама операция.
 * Разрешённые side effects: делегирует в action (resetUserSession/deleteUserHistory).
 */
async function handleUserHistoryAction(
  req: IncomingMessage,
  res: ServerResponse,
  deps: DashboardApiDeps,
  action: (userId: string, deps: ManageUserHistoryDeps) => Promise<void>,
): Promise<void> {
  if (!isAuthorized(req, deps.token)) {
    sendJson(res, 401, { error: 'unauthorized' });
    return;
  }
  const userId = extractUserId(await readJsonBody(req));
  if (!userId) {
    sendJson(res, 400, { error: 'missing_user_id' });
    return;
  }
  await action(userId, deps.userHistory);
  sendJson(res, 200, { ok: true });
}

/**
 * SPEC: resolveStaticPath
 * Назначение: превратить URL-путь в путь к файлу внутри staticDir, не давая
 *   выйти за его пределы через "..".
 * Входы/Выход: pathname + staticDir → абсолютный путь внутри staticDir, либо null
 * Разрешённые side effects: нет (чистая функция)
 */
function resolveStaticPath(pathname: string, staticDir: string): string | null {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const resolved = normalize(join(staticDir, requested));
  return resolved.startsWith(normalize(staticDir)) ? resolved : null;
}

async function handleStatic(res: ServerResponse, url: URL, staticDir: string): Promise<void> {
  const filePath = resolveStaticPath(url.pathname, staticDir);
  try {
    if (!filePath) throw new Error('path escapes staticDir');
    const body = await readFile(filePath);
    res.writeHead(200, { 'content-type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    // SPA client-side routing — любой неизвестный путь отдаёт index.html.
    const indexHtml = await readFile(join(staticDir, 'index.html'));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(indexHtml);
  }
}

function routeRequest(req: IncomingMessage, res: ServerResponse, url: URL, deps: DashboardApiDeps): Promise<void> {
  const method = req.method ?? 'GET';
  if (method === 'GET' && url.pathname === '/api/dashboard-metrics') return handleMetrics(req, res, url, deps);
  if (method === 'POST' && url.pathname === '/api/users/reset') {
    return handleUserHistoryAction(req, res, deps, resetUserSession);
  }
  if (method === 'POST' && url.pathname === '/api/users/delete') {
    return handleUserHistoryAction(req, res, deps, deleteUserHistory);
  }
  if (matchesConversationsRoute(method, url.pathname)) {
    return handleConversationsRoute(req, res, url, { conversationsQuery: deps.conversationsQuery, token: deps.token });
  }
  return handleStatic(res, url, deps.staticDir);
}

/**
 * SPEC: createDashboardApi
 * Назначение: HTTP-сервер internal-дашборда (метрики + таблица разговоров,
 *   см. conversationsApi.ts + управление историей пользователя + статика SPA)
 *   в одном процессе с ботом — общий SQLite-коннекшн, без второго писателя/читателя.
 * Входы/Выход: DashboardApiDeps → http.Server (не запущен, .listen вызывает index.ts)
 * Разрешённые side effects: нет своих (только через переданные deps)
 * Инварианты: /api/* без валидного Bearer-токена — 401, ни один ответ не содержит
 *   turns.text/profiles.value (CLAUDE.md §5) — getDashboardMetrics отдаёт только агрегаты.
 *   POST /api/users/delete необратим — no soft-delete/корзины на этом уровне,
 *   подтверждение — ответственность UI (см. dashboard/src/components/UserHistoryPanel.tsx).
 */
export function createDashboardApi(deps: DashboardApiDeps): Server {
  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    routeRequest(req, res, url, deps).catch(() => sendJson(res, 500, { error: 'internal_error' }));
  });
}
