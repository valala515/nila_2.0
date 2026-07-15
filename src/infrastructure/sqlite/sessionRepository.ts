import type Database from 'better-sqlite3';
import type { RecordUserTurnParams, SessionPort } from '../../application/ports/sessionPort.js';
import { INTERVIEW_PHASE_ORDER } from '../../domain/interviewProfile.js';

const INITIAL_PHASE = INTERVIEW_PHASE_ORDER[0];

/**
 * SPEC: createSessionRepository
 * Назначение: владеет таблицами sessions/bot_messages — границы одного
 *   разговора для дашборда (см. docs/domain-glossary.md, "Conversation") и
 *   транскрипт (реплики бота; ответы пользователя по-прежнему в turns).
 * Разрешённые side effects: INSERT/UPDATE sessions, INSERT bot_messages.
 * Инварианты: у пользователя в любой момент не более одной сессии с
 *   ended_at_iso IS NULL — openNewSession закрывает предыдущую перед вставкой новой.
 */
export function createSessionRepository(db: Database.Database): SessionPort {
  const selectOpenSession = db.prepare(
    'SELECT id FROM sessions WHERE user_id = ? AND ended_at_iso IS NULL ORDER BY id DESC LIMIT 1',
  );
  const closeOpenSessions = db.prepare('UPDATE sessions SET ended_at_iso = ? WHERE user_id = ? AND ended_at_iso IS NULL');
  const insertSession = db.prepare(`
    INSERT INTO sessions (user_id, started_at_iso, last_activity_at_iso, reached_phase, turn_count, total_answer_chars)
    VALUES (?, ?, ?, ?, 0, 0)
  `);
  const updateTurnProgress = db.prepare(`
    UPDATE sessions
    SET turn_count = turn_count + 1,
        total_answer_chars = total_answer_chars + ?,
        reached_phase = ?,
        last_activity_at_iso = ?,
        completed_at_iso = CASE WHEN ? = 1 THEN COALESCE(completed_at_iso, ?) ELSE completed_at_iso END
    WHERE id = ?
  `);
  const insertBotMessage = db.prepare(
    'INSERT INTO bot_messages (user_id, session_id, text, created_at_iso) VALUES (?, ?, ?, ?)',
  );
  const touchLastActivity = db.prepare('UPDATE sessions SET last_activity_at_iso = ? WHERE id = ?');

  const openNewSession = (userId: string): number => {
    const nowIso = new Date().toISOString();
    closeOpenSessions.run(nowIso, userId);
    const result = insertSession.run(userId, nowIso, nowIso, INITIAL_PHASE);
    return Number(result.lastInsertRowid);
  };

  return {
    async getOrOpenCurrentSession(userId: string): Promise<number> {
      const row = selectOpenSession.get(userId) as { id: number } | undefined;
      return row ? row.id : openNewSession(userId);
    },
    async openNewSession(userId: string): Promise<number> {
      return openNewSession(userId);
    },
    async recordUserTurn(sessionId: number, params: RecordUserTurnParams): Promise<void> {
      const nowIso = new Date().toISOString();
      updateTurnProgress.run(params.answerChars, params.phaseAfter, nowIso, params.completed ? 1 : 0, nowIso, sessionId);
    },
    async recordBotMessage(sessionId: number, userId: string, text: string): Promise<void> {
      const nowIso = new Date().toISOString();
      insertBotMessage.run(userId, sessionId, text, nowIso);
      touchLastActivity.run(nowIso, sessionId);
    },
  };
}
