import type Database from 'better-sqlite3';
import type {
  ConversationsFilter,
  ConversationsPage,
  ConversationSummary,
  ConversationsQueryPort,
  TranscriptEntry,
} from '../../application/ports/conversationsQueryPort.js';
import type { InterviewPhase } from '../../domain/interviewProfile.js';

interface SessionRow {
  id: number;
  user_id: string;
  started_at_iso: string;
  ended_at_iso: string | null;
  last_activity_at_iso: string;
  reached_phase: string;
  completed_at_iso: string | null;
  turn_count: number;
  total_answer_chars: number;
}

interface TextRow {
  text: string;
  created_at_iso: string;
}

function toSummary(row: SessionRow): ConversationSummary {
  return {
    sessionId: row.id,
    userId: row.user_id,
    startedAtIso: row.started_at_iso,
    endedAtIso: row.ended_at_iso,
    lastActivityAtIso: row.last_activity_at_iso,
    reachedPhase: row.reached_phase as InterviewPhase,
    completed: row.completed_at_iso !== null,
    turnCount: row.turn_count,
    avgAnswerChars: row.turn_count > 0 ? Math.round(row.total_answer_chars / row.turn_count) : 0,
  };
}

/**
 * SPEC: buildListConditions
 * Назначение: собрать WHERE-условия и параметры для listConversations —
 *   вынесено, чтобы сам запрос читался в один уровень абстракции.
 * Входы/Выход: фильтр + курсор → { whereClause, params }
 * Разрешённые side effects: нет (чистая функция)
 */
function buildListConditions(filter: ConversationsFilter, cursor: number | null): { whereClause: string; params: Array<string | number> } {
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (filter.userId) {
    conditions.push('user_id = ?');
    params.push(filter.userId);
  }
  if (filter.reachedPhase) {
    conditions.push('reached_phase = ?');
    params.push(filter.reachedPhase);
  }
  if (filter.completed === true) conditions.push('completed_at_iso IS NOT NULL');
  if (filter.completed === false) conditions.push('completed_at_iso IS NULL');
  if (cursor !== null) {
    conditions.push('id < ?');
    params.push(cursor);
  }

  return { whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

/**
 * SPEC: createConversationsRepository
 * Назначение: read-side для таблицы разговоров в дашборде — список сессий с
 *   keyset-пагинацией/фильтрами и слитый транскрипт (turns + bot_messages) одной сессии.
 * Входы/Выход: см. ConversationsQueryPort
 * Разрешённые side effects: нет (только SELECT)
 */
export function createConversationsRepository(db: Database.Database): ConversationsQueryPort {
  return {
    async listConversations(filter: ConversationsFilter, cursor: number | null, limit: number): Promise<ConversationsPage> {
      const { whereClause, params } = buildListConditions(filter, cursor);
      const rows = db
        .prepare(
          `SELECT id, user_id, started_at_iso, ended_at_iso, last_activity_at_iso, reached_phase, completed_at_iso, turn_count, total_answer_chars
           FROM sessions
           ${whereClause}
           ORDER BY id DESC
           LIMIT ?`,
        )
        .all(...params, limit + 1) as SessionRow[];

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const lastRow = page.at(-1);

      return {
        conversations: page.map(toSummary),
        nextCursor: hasMore && lastRow ? lastRow.id : null,
      };
    },

    async getTranscript(sessionId: number): Promise<TranscriptEntry[]> {
      const userTurns = db
        .prepare('SELECT text, created_at_iso FROM turns WHERE session_id = ? ORDER BY id ASC')
        .all(sessionId) as TextRow[];
      const botMessages = db
        .prepare('SELECT text, created_at_iso FROM bot_messages WHERE session_id = ? ORDER BY id ASC')
        .all(sessionId) as TextRow[];

      const entries: TranscriptEntry[] = [
        ...userTurns.map((row) => ({ role: 'user' as const, text: row.text, createdAtIso: row.created_at_iso })),
        ...botMessages.map((row) => ({ role: 'assistant' as const, text: row.text, createdAtIso: row.created_at_iso })),
      ];
      return entries.sort((a, b) => a.createdAtIso.localeCompare(b.createdAtIso));
    },
  };
}
