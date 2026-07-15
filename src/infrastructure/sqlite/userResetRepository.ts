import type Database from 'better-sqlite3';
import type { UserResetRepository } from '../../application/ports/userResetRepository.js';

/**
 * SPEC: createUserResetRepository
 * Назначение: необратимое удаление всех данных пользователя из SQL — для
 *   полной очистки тестового аккаунта (в отличие от SessionPort.openNewSession,
 *   который просто начинает новую сессию, не стирая прошлые).
 * Разрешённые side effects: DELETE из turns/profiles/events/sessions/bot_messages по user_id.
 */
export function createUserResetRepository(db: Database.Database): UserResetRepository {
  const deleteTurns = db.prepare('DELETE FROM turns WHERE user_id = ?');
  const deleteProfile = db.prepare('DELETE FROM profiles WHERE user_id = ?');
  const deleteEvents = db.prepare('DELETE FROM events WHERE user_id = ?');
  const deleteSessions = db.prepare('DELETE FROM sessions WHERE user_id = ?');
  const deleteBotMessages = db.prepare('DELETE FROM bot_messages WHERE user_id = ?');
  const deleteAll = db.transaction((userId: string) => {
    deleteTurns.run(userId);
    deleteProfile.run(userId);
    deleteEvents.run(userId);
    deleteSessions.run(userId);
    deleteBotMessages.run(userId);
  });

  return {
    async deleteAllUserData(userId: string): Promise<void> {
      deleteAll(userId);
    },
  };
}
