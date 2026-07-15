import type { AnalyticsEventPort } from '../ports/analyticsEventPort.js';
import type { FeedbackKind, PendingFeedbackRepository } from '../ports/pendingFeedbackRepository.js';
import type { SessionPort } from '../ports/sessionPort.js';
import type { TurnRepository } from '../ports/turnRepository.js';
import type { TurnChannel } from '../../domain/turnRecord.js';

export interface CollectInterviewFeedbackDeps {
  pendingFeedback: PendingFeedbackRepository;
  analyticsEvent: AnalyticsEventPort;
  session: SessionPort;
  turnRepository: TurnRepository;
}

const FELT_HEARD_QUESTION =
  'Before you go — on a scale of 1 to 5, how much did you feel heard during this conversation? (1 = not at all, 5 = completely)';
const FELT_HEARD_THANKS = "Thank you — that means a lot. I'm here whenever you want to talk again.";
const FELT_HEARD_RETRY = "That's not quite a number 1-5 — could you send just the digit?";

const FEEDBACK_PROMPTS: Record<FeedbackKind, string> = {
  felt_heard: FELT_HEARD_QUESTION,
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

function parseScore(text: string): number | null {
  const match = text.trim().match(/^[1-5]$/);
  return match ? Number(match[0]) : null;
}

/**
 * SPEC: collectInterviewFeedback
 * Назначение: обработать ответ пользователя на ожидающий feedback-опрос вместо
 *   обычного хода интервью.
 * Входы/Выход: userId, текст, канал, вид опроса → текст ответа бота
 * Разрешённые side effects: AnalyticsEventPort.record('feedback_submitted', ...)
 *   при валидной оценке, PendingFeedbackRepository.clearPending, сохранение
 *   сырого ответа пользователя (TurnRepository.save — без учёта в
 *   turn_count/reached_phase сессии, это опрос, не факт интервью) и ответа
 *   бота (SessionPort.recordBotMessage) — чтобы транскрипт разговора в
 *   дашборде не обрывался перед "Thank you".
 * Инварианты: невалидный ответ (не цифра 1-5) не очищает pending-статус —
 *   следующая реплика пользователя тоже трактуется как попытка оценки.
 */
export async function collectInterviewFeedback(
  userId: string,
  text: string,
  channel: TurnChannel,
  kind: FeedbackKind,
  deps: CollectInterviewFeedbackDeps,
): Promise<string> {
  const sessionId = await deps.session.getOrOpenCurrentSession(userId);
  await deps.turnRepository.save({ userId, channel, text, tone: 'neutral', createdAtIso: new Date().toISOString() }, sessionId);

  const score = parseScore(text);
  const replyText = score === null ? FELT_HEARD_RETRY : FELT_HEARD_THANKS;

  if (score !== null) {
    await deps.analyticsEvent.record('feedback_submitted', userId, { kind, score });
    await deps.pendingFeedback.clearPending(userId);
  }

  await deps.session.recordBotMessage(sessionId, userId, replyText);
  return replyText;
}
