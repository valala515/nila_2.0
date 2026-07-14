// Product-facing content (English — end users are English-speaking, see CLAUDE.md).
export const PROFILE_FIELD_CATALOG = [
  { key: 'mainConcern', description: 'the main concern the user came in with' },
  { key: 'goal', description: 'what the user wants to achieve' },
  { key: 'durationOrFrequency', description: 'how long this has been going on or how often it happens' },
  { key: 'severityOrImpact', description: 'how much this affects daily life' },
  { key: 'triedSoFar', description: 'what the user has already tried' },
  { key: 'preferredSupportStyle', description: 'how the user prefers to receive support' },
] as const;
// Черновой список полей для v1 (Sprint 1, тонкий срез) — состав и формулировки
// подлежат правке продуктом в Sprint 2 (Profile Synthesizer), см. docs/sprint-plan.md.

export type ProfileFieldKey = (typeof PROFILE_FIELD_CATALOG)[number]['key'];
export type FieldStatus = 'known' | 'missing' | 'deferred';

export interface ProfileField {
  readonly key: ProfileFieldKey;
  readonly status: FieldStatus;
  readonly value?: string;
  readonly confidence?: number;
  readonly evidenceQuote?: string;
}

export interface OpenThread {
  readonly topic: string;
  readonly sourceTurnId: number;
}

export interface InterviewProfile {
  readonly userId: string;
  readonly fields: ProfileField[];
  readonly openThreads: OpenThread[];
}

export function createEmptyProfile(userId: string): InterviewProfile {
  return {
    userId,
    fields: PROFILE_FIELD_CATALOG.map(({ key }) => ({ key, status: 'missing' as const })),
    openThreads: [],
  };
}

export interface ProfileUpdate {
  readonly fields: ProfileField[];
  readonly openThreads: OpenThread[];
}

export interface MergeResult {
  readonly profile: InterviewProfile;
  readonly contradictions: ProfileField[];
}

const CONTRADICTION_CONFIDENCE_THRESHOLD = 0.6;

/**
 * SPEC: applyInterviewUpdate
 * Назначение: смёржить обновление от interview engine в текущий профиль (correction path).
 * Входы/Выход: текущий InterviewProfile + ProfileUpdate → MergeResult
 * Разрешённые side effects: нет (чистая функция)
 * Инварианты: если для уже known-поля приходит другое known-значение с
 *   confidence >= порога — поле НЕ перезаписывается молча, а возвращается в
 *   contradictions; вызывающий код обязан спросить пользователя перед merge.
 *   openThreads из update заменяют текущие целиком — engine каждый раз
 *   пересчитывает список заново (по всему профилю + последним ходам), это не delta.
 * Запрещено: перезаписывать known-поле без явного подтверждения пользователя.
 */
export function applyInterviewUpdate(current: InterviewProfile, update: ProfileUpdate): MergeResult {
  const contradictions: ProfileField[] = [];
  const fieldsByKey = new Map(current.fields.map((field) => [field.key, field]));

  for (const incoming of update.fields) {
    const existing = fieldsByKey.get(incoming.key);
    const isConflicting =
      existing?.status === 'known' &&
      incoming.status === 'known' &&
      existing.value !== undefined &&
      incoming.value !== undefined &&
      incoming.value !== existing.value &&
      (incoming.confidence ?? 1) >= CONTRADICTION_CONFIDENCE_THRESHOLD;

    if (isConflicting) {
      contradictions.push(incoming);
      continue;
    }
    fieldsByKey.set(incoming.key, incoming);
  }

  return {
    profile: { userId: current.userId, fields: [...fieldsByKey.values()], openThreads: update.openThreads },
    contradictions,
  };
}
