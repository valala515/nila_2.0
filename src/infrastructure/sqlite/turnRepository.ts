import type Database from 'better-sqlite3';
import type { TurnRepository } from '../../application/ports/turnRepository.js';
import type { TurnRecord } from '../../domain/turnRecord.js';

interface TurnRow {
  id: number;
  user_id: string;
  channel: TurnRecord['channel'];
  text: string;
  tone: TurnRecord['tone'];
  created_at_iso: string;
}

export function createTurnRepository(db: Database.Database): TurnRepository {
  const insert = db.prepare(
    'INSERT INTO turns (user_id, channel, text, tone, created_at_iso) VALUES (?, ?, ?, ?, ?)',
  );
  const selectRecent = db.prepare(
    'SELECT id, user_id, channel, text, tone, created_at_iso FROM turns WHERE user_id = ? ORDER BY id DESC LIMIT ?',
  );

  return {
    async save(turn: TurnRecord): Promise<number> {
      const result = insert.run(turn.userId, turn.channel, turn.text, turn.tone, turn.createdAtIso);
      return Number(result.lastInsertRowid);
    },
    async listRecent(userId: string, limit: number): Promise<TurnRecord[]> {
      const rows = selectRecent.all(userId, limit) as TurnRow[];
      return rows
        .map((row) => ({
          id: row.id,
          userId: row.user_id,
          channel: row.channel,
          text: row.text,
          tone: row.tone,
          createdAtIso: row.created_at_iso,
        }))
        .reverse();
    },
  };
}
