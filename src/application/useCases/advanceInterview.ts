import { processUserUtterance, type ProcessUserUtteranceDeps } from './processUserUtterance.js';
import {
  createEmptyProfile,
  applyInterviewUpdate,
  PROFILE_FIELD_CATALOG,
  type InterviewProfile,
  type ProfileFieldKey,
} from '../../domain/interviewProfile.js';
import type { TurnChannel } from '../../domain/turnRecord.js';
import type { InterviewEnginePort } from '../ports/interviewEnginePort.js';
import type { InterviewProfileRepository } from '../ports/interviewProfileRepository.js';

const RECENT_TURNS_LIMIT = 6;

export interface AdvanceInterviewDeps extends ProcessUserUtteranceDeps {
  interviewEngine: InterviewEnginePort;
  interviewProfileRepository: InterviewProfileRepository;
}

export interface AdvanceInterviewResult {
  replyText: string;
  profile: InterviewProfile;
}

function describeField(key: ProfileFieldKey): string {
  return PROFILE_FIELD_CATALOG.find((field) => field.key === key)?.description ?? key;
}

function buildContradictionQuestion(oldValue: string, newValue: string, fieldKey: ProfileFieldKey): string {
  return `Quick check — earlier you said "${oldValue}" about ${describeField(fieldKey)}, but now it sounds like "${newValue}". Which one is accurate right now?`;
}

/**
 * SPEC: advanceInterview
 * Назначение: обработать реплику пользователя как ход интервью — обновить
 *   профиль (correction path) и вернуть следующий контекстно-зависимый вопрос.
 * Входы/Выход: userId, текст, канал → { replyText, profile }
 * Разрешённые side effects: сохранение хода (через processUserUtterance),
 *   сохранение профиля (InterviewProfileRepository), console.warn с id хода
 *   (без текста) при flaggedForReview — заглушка ручного review до Sprint 2.
 * Инварианты: known-поле не перезаписывается молча при расхождении —
 *   applyInterviewUpdate решает это; при расхождении вопрос от interview
 *   engine переопределяется явным уточнением.
 * Запрещено: логировать text/value полей за пределами processUserUtterance/
 *   InterviewProfileRepository (CLAUDE.md §5).
 */
export async function advanceInterview(
  userId: string,
  text: string,
  channel: TurnChannel,
  deps: AdvanceInterviewDeps,
): Promise<AdvanceInterviewResult> {
  const turn = await processUserUtterance(userId, text, channel, deps);

  const existingProfile = await deps.interviewProfileRepository.load(userId);
  const profile = existingProfile ?? createEmptyProfile(userId);

  // role filter: user only — turns хранит только реплики пользователя (см. TurnRepository).
  const recentTurns = await deps.turnRepository.listRecent(userId, RECENT_TURNS_LIMIT);

  const result = await deps.interviewEngine.advance({
    userAnswer: text,
    profile,
    recentTurns,
    tone: turn.tone,
  });

  if (result.flaggedForReview) {
    console.warn(`Interview turn flagged for review, turnId=${turn.id}`);
  }

  const { profile: mergedProfile, contradictions } = applyInterviewUpdate(profile, {
    fields: result.fieldUpdates,
    openThreads: result.openThreads,
  });

  await deps.interviewProfileRepository.save(mergedProfile);

  const conflict = contradictions[0];
  if (conflict) {
    const oldValue = profile.fields.find((field) => field.key === conflict.key)?.value ?? '';
    return {
      replyText: buildContradictionQuestion(oldValue, conflict.value ?? '', conflict.key),
      profile: mergedProfile,
    };
  }

  return { replyText: result.nextQuestion, profile: mergedProfile };
}
