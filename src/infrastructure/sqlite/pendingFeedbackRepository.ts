import type Database from 'better-sqlite3';
import type { FeedbackKind, PendingFeedbackRepository } from '../../application/ports/pendingFeedbackRepository.js';

export function createPendingFeedbackRepository(db: Database.Database): PendingFeedbackRepository {
  const setKind = db.prepare('UPDATE profiles SET pending_feedback_kind = ? WHERE user_id = ?');
  const selectKind = db.prepare('SELECT pending_feedback_kind FROM profiles WHERE user_id = ?');

  return {
    async setPending(userId: string, kind: FeedbackKind): Promise<void> {
      setKind.run(kind, userId);
    },
    async getPending(userId: string): Promise<FeedbackKind | null> {
      const row = selectKind.get(userId) as { pending_feedback_kind: FeedbackKind | null } | undefined;
      return row?.pending_feedback_kind ?? null;
    },
    async clearPending(userId: string): Promise<void> {
      setKind.run(null, userId);
    },
  };
}
