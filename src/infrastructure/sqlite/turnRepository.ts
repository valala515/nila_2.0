import type Database from 'better-sqlite3';
import type { TurnRepository } from '../../application/ports/turnRepository.js';
import type { TurnRecord } from '../../domain/turnRecord.js';

export function createTurnRepository(db: Database.Database): TurnRepository {
  const insert = db.prepare(
    'INSERT INTO turns (user_id, channel, text, tone, created_at_iso) VALUES (?, ?, ?, ?, ?)',
  );
  return {
    async save(turn: TurnRecord): Promise<void> {
      insert.run(turn.userId, turn.channel, turn.text, turn.tone, turn.createdAtIso);
    },
  };
}
