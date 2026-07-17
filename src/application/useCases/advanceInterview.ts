import { processUserUtterance, type ProcessUserUtteranceDeps } from './processUserUtterance.js';
import { requestInterviewFeedback } from './collectInterviewFeedback.js';
import {
  createEmptyProfile,
  applyInterviewUpdate,
  appendCategoryProgress,
  describeContradiction,
  fieldsTransitionedToKnown,
  isInterviewComplete,
  PHASE_NARRATIVE,
  type InterviewPhase,
  type InterviewProfile,
  type ProfileField,
} from '../../domain/interviewProfile.js';
import type { InterviewReplyOutcome, QuickRepliesKind } from '../../domain/interviewReply.js';
import type { TurnChannel, TurnRecord } from '../../domain/turnRecord.js';
import type { InterviewEnginePort, InterviewTurnResult } from '../ports/interviewEnginePort.js';
import type { InterviewProfileRepository } from '../ports/interviewProfileRepository.js';
import type { CheckpointReflectionPort } from '../ports/checkpointReflectionPort.js';
import type { AnalyticsEventPort } from '../ports/analyticsEventPort.js';
import type { PendingFeedbackRepository } from '../ports/pendingFeedbackRepository.js';
import type { SessionPort } from '../ports/sessionPort.js';

const RECENT_TURNS_LIMIT = 6;

export interface AdvanceInterviewDeps extends ProcessUserUtteranceDeps {
  interviewEngine: InterviewEnginePort;
  interviewProfileRepository: InterviewProfileRepository;
  checkpointReflection: CheckpointReflectionPort;
  analyticsEvent: AnalyticsEventPort;
  pendingFeedback: PendingFeedbackRepository;
  session: SessionPort;
}

export interface AdvanceInterviewResult extends InterviewReplyOutcome {
  readonly profile: InterviewProfile;
}

interface ResolvedReply {
  readonly text: string;
  readonly quickReplies: QuickRepliesKind;
}

// Переходы без своего LLM-отражения (history уже покрыт checkpointReflection.ts,
// intro не имеет входа-перехода) — получают статичную one-line "почему эта фаза".
// Выводится из PHASE_NARRATIVE (наличие purpose), а не из отдельного хардкода
// списка фаз, чтобы обе стороны не могли разойтись.
function isNarratedPhase(phase: InterviewPhase): phase is Exclude<InterviewPhase, 'synthesis'> {
  return phase !== 'synthesis' && PHASE_NARRATIVE[phase].purpose !== undefined;
}

interface TurnOutcome {
  userId: string;
  channel: TurnChannel;
  turn: TurnRecord;
  before: InterviewProfile;
  after: InterviewProfile;
  contradictions: ProfileField[];
  result: InterviewTurnResult;
  recentTurns: TurnRecord[];
  turnNumber: number;
  sessionId: number;
}

/**
 * SPEC: recordTurnAnalytics
 * Назначение: записать analytics-события одного хода интервью (turn answered
 *   + опционально phase advanced) — вынесено из advanceInterview ради
 *   cyclomatic complexity и единого уровня абстракции (CLAUDE.md §3).
 * Входы/Выход: TurnOutcome + AnalyticsEventPort → void
 * Разрешённые side effects: AnalyticsEventPort.record (только категории/ключи полей)
 */
async function recordTurnAnalytics(outcome: TurnOutcome, analyticsEvent: AnalyticsEventPort): Promise<void> {
  await analyticsEvent.record('interview_turn_answered', outcome.userId, {
    turnNumber: outcome.turnNumber,
    phase: outcome.before.currentPhase,
    fieldsTransitionedToKnown: fieldsTransitionedToKnown(outcome.before, outcome.after),
    toneLabel: outcome.turn.tone,
    channel: outcome.channel,
  });

  if (outcome.after.currentPhase === outcome.before.currentPhase) return;
  await analyticsEvent.record('interview_phase_advanced', outcome.userId, {
    fromPhase: outcome.before.currentPhase,
    toPhase: outcome.after.currentPhase,
    turnNumber: outcome.turnNumber,
  });
}

/**
 * SPEC: recordSessionProgress
 * Назначение: обновить денормализованные агрегаты сессии для таблицы
 *   разговоров в дашборде (turn_count, total_answer_chars, reached_phase,
 *   completed_at_iso) — вынесено рядом с recordTurnAnalytics по тем же
 *   причинам (single-responsibility, CLAUDE.md §3/§4).
 * Входы/Выход: TurnOutcome + SessionPort → void
 * Разрешённые side effects: SessionPort.recordUserTurn
 */
async function recordSessionProgress(outcome: TurnOutcome, session: SessionPort): Promise<void> {
  const enteredSynthesis = !isInterviewComplete(outcome.before) && isInterviewComplete(outcome.after);
  await session.recordUserTurn(outcome.sessionId, {
    answerChars: outcome.turn.text.length,
    phaseAfter: outcome.after.currentPhase,
    completed: enteredSynthesis,
  });
}

/**
 * SPEC: resolveReply
 * Назначение: выбрать текст ответа пользователю по итогам хода — уточнение
 *   при contradiction, checkpoint-отражение на impact→history, статичная
 *   one-line "почему эта фаза" (PHASE_NARRATIVE.purpose) на входе в impact/
 *   support/readiness, felt-heard опрос на первом входе в synthesis, иначе
 *   обычный nextQuestion от engine. Квикреплаи (👍/👎) показываются только под
 *   felt-heard опросом — решение пользователя 16 июля после живого теста в
 *   Telegram: кнопки под каждым вопросом интервью оказались избыточны (см.
 *   docs/sprint-plan.md). Суффикс appendCategoryProgress добавляется прямо в
 *   этой функции — везде, кроме conflict и felt-heard опроса, где прогресс
 *   неуместен — так возвращённый текст уже финальный, без отдельного
 *   пост-обработки шага в advanceInterview.
 * Входы/Выход: TurnOutcome + AdvanceInterviewDeps → { text, quickReplies }
 * Разрешённые side effects: CheckpointReflectionPort.reflect, AnalyticsEventPort.record
 *   ('interview_completed'), PendingFeedbackRepository.setPending (через requestInterviewFeedback)
 */
async function resolveReply(outcome: TurnOutcome, deps: AdvanceInterviewDeps): Promise<ResolvedReply> {
  const conflict = outcome.contradictions[0];
  if (conflict) {
    return { text: describeContradiction(outcome.before, conflict), quickReplies: 'none' };
  }

  const enteredHistoryPhase = outcome.before.currentPhase === 'impact' && outcome.after.currentPhase === 'history';
  if (enteredHistoryPhase) {
    const text = await deps.checkpointReflection.reflect(outcome.after, outcome.recentTurns);
    return { text: appendCategoryProgress(text, outcome.after), quickReplies: 'none' };
  }

  const enteredSynthesisPhase = !isInterviewComplete(outcome.before) && isInterviewComplete(outcome.after);
  if (enteredSynthesisPhase) {
    await deps.analyticsEvent.record('interview_completed', outcome.userId, { totalTurns: outcome.turnNumber });
    const text = await requestInterviewFeedback(outcome.userId, 'felt_heard', deps);
    return { text, quickReplies: 'experience' };
  }

  if (outcome.before.currentPhase !== outcome.after.currentPhase && isNarratedPhase(outcome.after.currentPhase)) {
    const purpose = PHASE_NARRATIVE[outcome.after.currentPhase].purpose;
    const text = `${purpose} ${outcome.result.nextQuestion}`;
    return { text: appendCategoryProgress(text, outcome.after), quickReplies: 'none' };
  }

  return { text: appendCategoryProgress(outcome.result.nextQuestion, outcome.after), quickReplies: 'none' };
}

/**
 * SPEC: advanceInterview
 * Назначение: обработать реплику пользователя как ход интервью — обновить
 *   профиль (correction path) и вернуть следующий контекстно-зависимый вопрос.
 * Входы/Выход: userId, текст, канал → { replyText, profile }
 * Разрешённые side effects: сохранение хода (через processUserUtterance),
 *   сохранение профиля (InterviewProfileRepository), console.warn с id хода
 *   (без текста) при flaggedForReview — заглушка ручного review до Sprint 2,
 *   вызов CheckpointReflectionPort на переходе impact → history, запись
 *   analytics-событий (interview_turn_answered/interview_phase_advanced/
 *   interview_completed — только категории/ключи полей, без values, CLAUDE.md
 *   §5), запрос felt-heard опроса при первом входе в synthesis, обновление
 *   агрегатов сессии (SessionPort.recordUserTurn) и сохранение реплики бота
 *   (SessionPort.recordBotMessage) — для таблицы разговоров в дашборде.
 * Инварианты: known-поле не перезаписывается молча при расхождении —
 *   applyInterviewUpdate решает это; при расхождении вопрос от interview
 *   engine переопределяется явным уточнением (приоритет выше checkpoint).
 *   Ровно на ходу, где currentPhase меняется с 'impact' на 'history', вместо
 *   обычного nextQuestion от engine возвращается checkpoint-отражение —
 *   единое сообщение (reflection + переход в первый вопрос history), не два
 *   сообщения подряд. На ходу, где currentPhase меняется на 'impact'/'support'/
 *   'readiness', перед nextQuestion добавляется статичная one-line
 *   PHASE_NARRATIVE.purpose. Суффикс appendCategoryProgress уже включён в
 *   text, который вернул resolveReply (см. его SPEC) — сохранённый в
 *   bot_messages текст совпадает с отправленным пользователю без
 *   дополнительного шага здесь.
 * Запрещено: логировать text/value полей за пределами processUserUtterance/
 *   InterviewProfileRepository (CLAUDE.md §5).
 */
export async function advanceInterview(
  userId: string,
  text: string,
  channel: TurnChannel,
  deps: AdvanceInterviewDeps,
): Promise<AdvanceInterviewResult> {
  const sessionId = await deps.session.getOrOpenCurrentSession(userId);
  const existingProfile = await deps.interviewProfileRepository.load(userId);
  const profile = existingProfile ?? createEmptyProfile(userId);

  const turn = await processUserUtterance(userId, text, channel, sessionId, deps);
  // role filter: user only — turns хранит только реплики пользователя (см. TurnRepository).
  const recentTurns = await deps.turnRepository.listRecent(sessionId, RECENT_TURNS_LIMIT);
  const result = await deps.interviewEngine.advance({ userAnswer: text, profile, recentTurns, tone: turn.tone });

  if (result.flaggedForReview) {
    console.warn(`Interview turn flagged for review, turnId=${turn.id}`);
  }

  const { profile: mergedProfile, contradictions } = applyInterviewUpdate(profile, {
    fields: result.fieldUpdates,
    openThreads: result.openThreads,
  });

  await deps.interviewProfileRepository.save(mergedProfile);

  const turnNumber = await deps.turnRepository.countForSession(sessionId);
  const outcome: TurnOutcome = {
    userId,
    channel,
    turn,
    before: profile,
    after: mergedProfile,
    contradictions,
    result,
    recentTurns,
    turnNumber,
    sessionId,
  };

  await recordTurnAnalytics(outcome, deps.analyticsEvent);
  await recordSessionProgress(outcome, deps.session);
  const reply = await resolveReply(outcome, deps);
  await deps.session.recordBotMessage(sessionId, userId, reply.text);
  return { replyText: reply.text, profile: mergedProfile, quickReplies: reply.quickReplies };
}
