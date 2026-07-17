import { missingFieldsInPhase, PROFILE_FIELD_CATALOG, type InterviewProfile, type ProfileFieldKey } from '../../domain/interviewProfile.js';
import type { InterviewEnginePort, InterviewTurnResult } from '../../application/ports/interviewEnginePort.js';

function descriptionFor(key: ProfileFieldKey): string {
  return PROFILE_FIELD_CATALOG.find((field) => field.key === key)?.description ?? key;
}

// Заполняет ровно одно missing-поле текущей фазы placeholder-значением,
// независимо от того, что реально написал пользователь — реального
// понимания текста здесь нет и не нужно, это только для прохода по фазам.
function fillNextMissingField(profile: InterviewProfile): InterviewTurnResult {
  const missing = missingFieldsInPhase(profile, profile.currentPhase);
  const key = missing[0];
  if (!key) {
    return { fieldUpdates: [], openThreads: [], nextQuestion: '[TEST MODE] Nothing left to fill here — reply with anything to continue.', flaggedForReview: false };
  }

  const upcomingKey = missing[1];
  const nextQuestion = upcomingKey
    ? `[TEST MODE] Recorded "${key}". Reply with anything to fill: ${descriptionFor(upcomingKey)}.`
    : `[TEST MODE] Recorded "${key}" — that closes this phase. Reply with anything to move on.`;

  return {
    fieldUpdates: [{ key, status: 'known', value: `(test) ${key}`, confidence: 1 }],
    openThreads: [],
    nextQuestion,
    flaggedForReview: false,
  };
}

/**
 * SPEC: createTestModeInterviewEngine
 * Назначение: для allowlisted userId — заменить реальный (OpenAI) interview
 *   engine детерминированной заглушкой, которая на любой ответ заполняет
 *   очередное missing-поле текущей фазы placeholder-значением. Даёт быстро
 *   пройти весь интервью (все 5 фаз) в живом Telegram без придумывания
 *   реалистичных ответов на каждый вопрос — только ручной QA прогресса по
 *   фазам/переходам (progress-бар, phase-intro, checkpoint), не проверка
 *   самого LLM-извлечения фактов.
 * Входы/Выход: реальный InterviewEnginePort + allowlist userId → InterviewEnginePort
 * Разрешённые side effects: делегирует в realEngine.advance для не-allowlisted userId
 * Инварианты: пустой allowlist (по умолчанию) — realEngine вызывается всегда,
 *   поведение для обычных пользователей не меняется.
 */
export function createTestModeInterviewEngine(realEngine: InterviewEnginePort, testUserIds: readonly string[]): InterviewEnginePort {
  const allowlist = new Set(testUserIds);
  return {
    async advance(input) {
      if (!allowlist.has(input.profile.userId)) return realEngine.advance(input);
      return fillNextMissingField(input.profile);
    },
  };
}
