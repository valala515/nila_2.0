import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ConversationsFilter, ConversationsQueryPort } from '../application/ports/conversationsQueryPort.js';
import type { InterviewPhase } from '../domain/interviewProfile.js';

export interface ConversationsApiDeps {
  conversationsQuery: ConversationsQueryPort;
  token: string;
}

const DEFAULT_LIST_LIMIT = 25;
const EXPORT_LIMIT = 500;
const TRANSCRIPT_PATH_PATTERN = /^\/api\/conversations\/(\d+)\/transcript$/;

function isAuthorized(req: IncomingMessage, token: string): boolean {
  return req.headers.authorization === `Bearer ${token}`;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function parseCompletedFilter(value: string | null): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function parseConversationsFilter(url: URL): ConversationsFilter {
  const userId = url.searchParams.get('userId');
  const reachedPhase = url.searchParams.get('reachedPhase') as InterviewPhase | null;
  const completed = parseCompletedFilter(url.searchParams.get('completed'));
  return {
    ...(userId ? { userId } : {}),
    ...(reachedPhase ? { reachedPhase } : {}),
    ...(completed !== undefined ? { completed } : {}),
  };
}

async function handleList(req: IncomingMessage, res: ServerResponse, url: URL, deps: ConversationsApiDeps): Promise<void> {
  const cursorParam = url.searchParams.get('cursor');
  const cursor = cursorParam ? Number(cursorParam) : null;
  const limit = Number(url.searchParams.get('limit')) || DEFAULT_LIST_LIMIT;
  const page = await deps.conversationsQuery.listConversations(parseConversationsFilter(url), cursor, limit);
  sendJson(res, 200, page);
}

/**
 * SPEC: handleExport
 * Назначение: скачать разговоры, подходящие под фильтр, вместе с полным
 *   транскриптом каждого — для ручного анализа вопросов/дропов.
 * Разрешённые side effects: нет (только чтение через ConversationsQueryPort)
 * Инварианты: софт-кап EXPORT_LIMIT разговоров за запрос — ответ явно
 *   помечает truncated, чтобы UI не показал урезанный набор как полный.
 */
async function handleExport(req: IncomingMessage, res: ServerResponse, url: URL, deps: ConversationsApiDeps): Promise<void> {
  const page = await deps.conversationsQuery.listConversations(parseConversationsFilter(url), null, EXPORT_LIMIT + 1);
  const truncated = page.conversations.length > EXPORT_LIMIT;
  const sessions = truncated ? page.conversations.slice(0, EXPORT_LIMIT) : page.conversations;

  const conversations = await Promise.all(
    sessions.map(async (session) => ({ session, transcript: await deps.conversationsQuery.getTranscript(session.sessionId) })),
  );
  sendJson(res, 200, { truncated, conversations });
}

async function handleTranscript(res: ServerResponse, sessionId: number, deps: ConversationsApiDeps): Promise<void> {
  const transcript = await deps.conversationsQuery.getTranscript(sessionId);
  sendJson(res, 200, { transcript });
}

/** Синхронная проверка — dashboardApi.ts решает, делегировать ли сюда, до чтения тела запроса. */
export function matchesConversationsRoute(method: string, pathname: string): boolean {
  if (method !== 'GET') return false;
  return pathname === '/api/conversations' || pathname === '/api/conversations/export' || TRANSCRIPT_PATH_PATTERN.test(pathname);
}

/**
 * SPEC: handleConversationsRoute
 * Назначение: обработать один из /api/conversations* маршрутов — вызывается
 *   только когда matchesConversationsRoute уже вернул true.
 * Разрешённые side effects: делегирует в handleList/handleExport/handleTranscript
 * Инварианты: без валидного Bearer-токена — 401, до любого чтения из БД.
 */
export async function handleConversationsRoute(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: ConversationsApiDeps,
): Promise<void> {
  if (!isAuthorized(req, deps.token)) {
    sendJson(res, 401, { error: 'unauthorized' });
    return;
  }

  if (url.pathname === '/api/conversations') return handleList(req, res, url, deps);
  if (url.pathname === '/api/conversations/export') return handleExport(req, res, url, deps);

  const transcriptMatch = url.pathname.match(TRANSCRIPT_PATH_PATTERN);
  if (transcriptMatch) return handleTranscript(res, Number(transcriptMatch[1]), deps);
}
