import {
  INTERVIEW_PHASE_ORDER,
  isInterviewComplete,
  missingFieldsInPhase,
  PHASE_NARRATIVE,
  PROFILE_FIELD_CATALOG,
  type InterviewPhase,
  type InterviewProfile,
  type ProfileFieldKey,
} from '../../domain/interviewProfile.js';
import type { InterviewProfileRepository } from '../ports/interviewProfileRepository.js';

type NarratedPhase = Exclude<InterviewPhase, 'synthesis'>;

const NARRATED_PHASES = INTERVIEW_PHASE_ORDER.filter((phase): phase is NarratedPhase => phase !== 'synthesis');

export interface MiniAppPhaseSummary {
  readonly key: NarratedPhase;
  readonly label: string;
  readonly closedFields: number;
  readonly totalFields: number;
  readonly isCurrent: boolean;
  readonly isDone: boolean;
}

export interface MiniAppFact {
  readonly phase: NarratedPhase;
  readonly key: ProfileFieldKey;
  readonly description: string;
  readonly value: string;
}

export interface MiniAppProfileViewModel {
  readonly displayName?: string;
  readonly currentPhase: InterviewPhase;
  readonly interviewComplete: boolean;
  readonly phases: MiniAppPhaseSummary[];
  readonly facts: MiniAppFact[];
}

export interface GetProfileForMiniAppDeps {
  readonly interviewProfileRepository: InterviewProfileRepository;
}

function phaseFieldCount(phase: NarratedPhase): number {
  return PROFILE_FIELD_CATALOG.filter((field) => field.phase === phase).length;
}

function summarizePhases(profile: InterviewProfile): MiniAppPhaseSummary[] {
  const currentIndex = INTERVIEW_PHASE_ORDER.indexOf(profile.currentPhase);
  return NARRATED_PHASES.map((phase, index) => {
    const total = phaseFieldCount(phase);
    return {
      key: phase,
      label: PHASE_NARRATIVE[phase].label,
      closedFields: total - missingFieldsInPhase(profile, phase).length,
      totalFields: total,
      isCurrent: phase === profile.currentPhase,
      isDone: index < currentIndex,
    };
  });
}

// role filter: n/a — читает не переписку, а извлечённые поля профиля (уже
// прошли через interview engine), а не сырой текст пользователя.
function collectKnownFacts(profile: InterviewProfile): MiniAppFact[] {
  const fieldByKey = new Map(profile.fields.map((field) => [field.key, field]));
  const facts: MiniAppFact[] = [];
  for (const { key, phase, description } of PROFILE_FIELD_CATALOG) {
    const field = fieldByKey.get(key);
    if (field?.status === 'known' && field.value !== undefined) {
      facts.push({ phase, key, description, value: field.value });
    }
  }
  return facts;
}

/**
 * SPEC: getProfileForMiniApp
 * Назначение: собрать view-model экрана профиля для Telegram Mini App
 *   (src/transport/miniapp) — per-phase прогресс + известные факты с
 *   описанием "почему я спросила" из PROFILE_FIELD_CATALOG.
 * Входы/Выход: userId (уже проверенный verifyInitData на transport-уровне) →
 *   MiniAppProfileViewModel, либо null если профиля ещё нет (пользователь
 *   не начинал интервью).
 * Разрешённые side effects: чтение через InterviewProfileRepository
 * Инварианты: не включает deferred/missing поля в facts — только known со
 *   значением; deferred остаётся внутренним статусом, не UI-фактом.
 */
export async function getProfileForMiniApp(userId: string, deps: GetProfileForMiniAppDeps): Promise<MiniAppProfileViewModel | null> {
  const profile = await deps.interviewProfileRepository.load(userId);
  if (!profile) return null;

  return {
    ...(profile.displayName !== undefined ? { displayName: profile.displayName } : {}),
    currentPhase: profile.currentPhase,
    interviewComplete: isInterviewComplete(profile),
    phases: summarizePhases(profile),
    facts: collectKnownFacts(profile),
  };
}
