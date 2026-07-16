import type { AnalyticsEventPort } from '../ports/analyticsEventPort.js';
import type { FeedbackKind, PendingFeedbackRepository } from '../ports/pendingFeedbackRepository.js';
import type { SessionPort } from '../ports/sessionPort.js';
import type { TurnRepository } from '../ports/turnRepository.js';
import { EXPERIENCE_RATING_SCORE, type ExperienceRatingChoice } from '../../domain/experienceRating.js';

export type { ExperienceRatingChoice };

export interface CollectInterviewFeedbackDeps {
  pendingFeedback: PendingFeedbackRepository;
  analyticsEvent: AnalyticsEventPort;
  session: SessionPort;
  turnRepository: TurnRepository;
}

const EXPERIENCE_RATING_QUESTION = 'Before you go — how did this conversation feel?';
const EXPERIENCE_RATING_THANKS = "Thank you — that means a lot. I'm here whenever you want to talk again.";

// Метка нажатой кнопки, а не свободный текст — сохраняется в turns, чтобы
// транскрипт разговора в дашборде не обрывался немым местом между вопросом
// бота и "Thank you" (см. corrections в docs/sprint-plan.md).
const EXPERIENCE_CHOICE_LABEL: Record<ExperienceRatingChoice, string> = { up: '👍', down: '👎' };

const FEEDBACK_PROMPTS: Record<FeedbackKind, string> = {
  felt_heard: EXPERIENCE_RATING_QUESTION,
};

/**
 * SPEC: requestInterviewFeedback
 * Назначение: пометить пользователя как ожидающего ответа-оценки (не реплики
 *   интервью) и вернуть текст вопроса.
 * Входы/Выход: userId, вид опроса → текст вопроса
 * Разрешённые side effects: PendingFeedbackRepository.setPending
 */
export async function requestInterviewFeedback(
  userId: string,
  kind: FeedbackKind,
  deps: Pick<CollectInterviewFeedbackDeps, 'pendingFeedback'>,
): Promise<string> {
  await deps.pendingFeedback.setPending(userId, kind);
  return FEEDBACK_PROMPTS[kind];
}

/**
 * SPEC: submitExperienceRating
 * Назначение: обработать нажатие 👍/👎 под опросом об опыте разговора — снять
 *   ожидание оценки, записать нажатую кнопку как ход пользователя (иначе она
 *   не видна в транскрипте дашборда), записать analytics-событие и вернуть
 *   текст-благодарность.
 * Входы/Выход: userId, выбор пользователя → текст ответа бота (благодарность)
 * Разрешённые side effects: AnalyticsEventPort.record('feedback_submitted', ...),
 *   PendingFeedbackRepository.clearPending (параллельно с
 *   SessionPort.getOrOpenCurrentSession — независимые вызовы), TurnRepository.save
 *   (метка кнопки 👍/👎, не свободный текст — не подпадает под запрет CLAUDE.md §5
 *   на логирование сырого текста), SessionPort.recordBotMessage
 */
export async function submitExperienceRating(
  userId: string,
  choice: ExperienceRatingChoice,
  deps: CollectInterviewFeedbackDeps,
): Promise<string> {
  await deps.analyticsEvent.record('feedback_submitted', userId, { kind: 'felt_heard', score: EXPERIENCE_RATING_SCORE[choice] });
  const [sessionId] = await Promise.all([deps.session.getOrOpenCurrentSession(userId), deps.pendingFeedback.clearPending(userId)]);
  await deps.turnRepository.save(
    { userId, channel: 'text', text: EXPERIENCE_CHOICE_LABEL[choice], tone: 'neutral', createdAtIso: new Date().toISOString() },
    sessionId,
  );
  await deps.session.recordBotMessage(sessionId, userId, EXPERIENCE_RATING_THANKS);
  return EXPERIENCE_RATING_THANKS;
}
