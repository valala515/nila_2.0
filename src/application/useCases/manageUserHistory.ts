import { createEmptyProfile } from '../../domain/interviewProfile.js';
import type { InterviewProfileRepository } from '../ports/interviewProfileRepository.js';
import type { PendingFeedbackRepository } from '../ports/pendingFeedbackRepository.js';
import type { SessionPort } from '../ports/sessionPort.js';
import type { UserResetRepository } from '../ports/userResetRepository.js';
import type { AnalyticsEventPort } from '../ports/analyticsEventPort.js';

export interface ManageUserHistoryDeps {
  interviewProfileRepository: InterviewProfileRepository;
  pendingFeedback: PendingFeedbackRepository;
  session: SessionPort;
  userReset: UserResetRepository;
  analyticsEvent: AnalyticsEventPort;
}

/**
 * SPEC: resetUserSession
 * Назначение: сделать так, чтобы для пользователя в Telegram следующий ответ
 *   бота выглядел как начало нового разговора — профиль пуст, ожидание
 *   felt-heard отменено, открывается новая сессия (SessionPort.openNewSession,
 *   закрывает предыдущую) — но сами строки turns/bot_messages/events за
 *   прошлую сессию из SQL не удаляются, остаются как отдельный разговор
 *   в таблице разговоров дашборда.
 * Входы/Выход: userId + ManageUserHistoryDeps → void
 * Разрешённые side effects: перезапись профиля пустым, очистка pending
 *   feedback, SessionPort.openNewSession, событие 'user_session_reset'
 *   (без values — CLAUDE.md §5).
 */
export async function resetUserSession(userId: string, deps: ManageUserHistoryDeps): Promise<void> {
  await deps.interviewProfileRepository.save(createEmptyProfile(userId));
  await deps.pendingFeedback.clearPending(userId);
  await deps.session.openNewSession(userId);
  await deps.analyticsEvent.record('user_session_reset', userId, {});
}

/**
 * SPEC: deleteUserHistory
 * Назначение: необратимо стереть все данные пользователя из SQL (turns,
 *   profiles, events, sessions, bot_messages) — для полной очистки тестового
 *   аккаунта.
 * Входы/Выход: userId + ManageUserHistoryDeps → void
 * Разрешённые side effects: DELETE по всем таблицам, содержащим user_id.
 * Запрещено: восстановление после вызова — нет soft-delete/корзины.
 */
export async function deleteUserHistory(userId: string, deps: ManageUserHistoryDeps): Promise<void> {
  await deps.userReset.deleteAllUserData(userId);
}
