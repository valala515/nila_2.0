// Product-facing content (English — end users are English-speaking, see CLAUDE.md).
// Каждое поле помечено фазой интервью (см. InterviewPhase) — так собираем
// глубокий профиль постепенно за несколько ходов, а не одним допросом.
// 'synthesis' полей не имеет — это финальный шаг (Future You brief,
// см. docs/domain-glossary.md), отдельный от per-turn извлечения фактов.
export const PROFILE_FIELD_CATALOG = [
  // intro — presenting problem + базовые демографические данные
  { key: 'mainConcern', description: 'the main concern the user came in with', phase: 'intro' },
  { key: 'goal', description: 'what the user wants to achieve', phase: 'intro' },
  { key: 'durationOrFrequency', description: 'how long this has been going on or how often it happens', phase: 'intro' },
  { key: 'age', description: "the user's age", phase: 'intro' },
  { key: 'gender', description: "the user's gender", phase: 'intro' },
  { key: 'weight', description: "the user's weight — okay to defer if the user doesn't want to share it", phase: 'intro' },
  { key: 'height', description: "the user's height — okay to defer if the user doesn't want to share it", phase: 'intro' },

  // impact — what the problem took from the person
  { key: 'severityOrImpact', description: 'how much this affects daily life', phase: 'impact' },
  { key: 'activitiesGivenUp', description: 'activities or habits the user gave up because of the problem', phase: 'impact' },
  { key: 'impactOnRelationshipsAndConfidence', description: 'how the problem affected relationships, confidence, or independence', phase: 'impact' },
  { key: 'roleOfProblemNow', description: 'what role the problem plays in the user’s life right now', phase: 'impact' },

  // history — emotional causes and past attempts
  { key: 'triedSoFar', description: 'what the user has already tried', phase: 'history' },
  { key: 'whyPastAttemptsFailed', description: 'why past attempts to fix this didn’t work', phase: 'history' },
  { key: 'preSlipTriggers', description: 'what tends to happen right before the user slips or gives up', phase: 'history' },
  { key: 'shamefulAdviceReactions', description: 'advice or comments that made the user feel shame, guilt, or resistance', phase: 'history' },
  { key: 'fearsAboutTryingAgain', description: 'what the user is afraid of if they try to change again', phase: 'history' },

  // support — how to be safe and helpful, not judgmental
  { key: 'preferredSupportStyle', description: 'how the user prefers to receive support', phase: 'support' },
  { key: 'toneReadAsCaring', description: 'what tone or phrasing the user reads as caring', phase: 'support' },
  { key: 'toneReadAsJudgmental', description: 'what tone or phrasing the user reads as judgmental or patronizing', phase: 'support' },
  { key: 'directnessPreference', description: 'how bluntly the user wants to be told things', phase: 'support' },
  { key: 'explanationVsActionPreference', description: 'whether the user wants explanations or just short actions', phase: 'support' },
  { key: 'topicsToAvoidProactive', description: 'topics that must not come up in proactive (unprompted) messages', phase: 'support' },

  // readiness — consent and pacing for what comes next
  { key: 'readyToTryNow', description: 'what the user is willing to try right now', phase: 'readiness' },
  { key: 'notReadyYet', description: 'what the user is explicitly not ready to do yet', phase: 'readiness' },
  { key: 'whenNilaCanSuggestActions', description: 'when it’s okay for Nila to proactively suggest actions', phase: 'readiness' },
  { key: 'canRevisitSensitiveTopicLater', description: 'whether a sensitive topic can be brought up again later', phase: 'readiness' },
  { key: 'wantsProactiveMessages', description: 'whether the user wants proactive check-ins or only replies on request', phase: 'readiness' },
] as const;
// Черновой список полей (Sprint 1 → расширен по интервью-целям продукта, см.
// docs/sprint-plan.md) — состав и формулировки подлежат дальнейшей правке.

export type ProfileFieldKey = (typeof PROFILE_FIELD_CATALOG)[number]['key'];
export type FieldStatus = 'known' | 'missing' | 'deferred';

// Порядок = порядок прохождения; 'synthesis' — терминальная фаза без
// собственных полей, там строится Future You brief поверх готового профиля.
export const INTERVIEW_PHASE_ORDER = ['intro', 'impact', 'history', 'support', 'readiness', 'synthesis'] as const;
export type InterviewPhase = (typeof INTERVIEW_PHASE_ORDER)[number];

const DEMOGRAPHIC_FIELD_KEYS: readonly ProfileFieldKey[] = ['age', 'gender', 'weight', 'height'];

// label — для всех 5 нетерминальных фаз (прогресс-строка); purpose — только для
// переходов без своего LLM-отражения (impact/support/readiness). 'history' уже
// покрыт checkpointReflection.ts, 'intro' не имеет входа-перехода.
export const PHASE_NARRATIVE: Record<Exclude<InterviewPhase, 'synthesis'>, { readonly label: string; readonly purpose?: string }> = {
  intro: { label: 'Intro' },
  impact: {
    label: 'Impact',
    purpose:
      "Now that I know what's going on, I want to understand how it's actually been affecting your day-to-day — that's what tells me which kind of help would actually matter.",
  },
  history: { label: 'History' },
  support: {
    label: 'Support',
    purpose:
      'This next part is about how you want to be supported — everyone hears feedback differently, and getting this right means I won\'t accidentally sound preachy or miss the mark.',
  },
  readiness: {
    label: 'Readiness',
    purpose:
      "Last stretch — I want to know what you're actually ready to try right now, so anything I suggest later fits where you are, not where I assume you should be.",
  },
};

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
  readonly currentPhase: InterviewPhase;
  /** Telegram nickname (first_name/username) — identity, not an interview-extracted fact; see greetNewUser.ts. */
  readonly displayName?: string;
}

export function createEmptyProfile(userId: string, displayName?: string): InterviewProfile {
  return {
    userId,
    fields: PROFILE_FIELD_CATALOG.map(({ key }) => ({ key, status: 'missing' as const })),
    openThreads: [],
    currentPhase: INTERVIEW_PHASE_ORDER[0],
    ...(displayName !== undefined ? { displayName } : {}),
  };
}

function fieldKeysInPhase(phase: InterviewPhase): ProfileFieldKey[] {
  return PROFILE_FIELD_CATALOG.filter((field) => field.phase === phase).map((field) => field.key);
}

/**
 * SPEC: missingFieldsInPhase
 * Назначение: узнать, какие поля текущей фазы ещё не заполнены (known/deferred).
 * Входы/Выход: профиль + фаза → ключи полей этой фазы со статусом missing
 * Разрешённые side effects: нет (чистая функция)
 */
export function missingFieldsInPhase(profile: InterviewProfile, phase: InterviewPhase): ProfileFieldKey[] {
  const phaseKeys = fieldKeysInPhase(phase);
  const statusByKey = new Map(profile.fields.map((field) => [field.key, field.status]));
  return phaseKeys.filter((key) => (statusByKey.get(key) ?? 'missing') === 'missing');
}

/**
 * SPEC: onlyDemographicFieldsRemaining
 * Назначение: сигнал для interview engine — пора спросить возраст/пол/вес
 *   напрямую и коротко, а не socratic-вопросом, потому что это всё, что
 *   осталось незаполненным в фазе.
 * Входы/Выход: профиль + фаза → boolean
 * Разрешённые side effects: нет (чистая функция)
 */
export function onlyDemographicFieldsRemaining(profile: InterviewProfile, phase: InterviewPhase): boolean {
  const missing = missingFieldsInPhase(profile, phase);
  return missing.length > 0 && missing.every((key) => DEMOGRAPHIC_FIELD_KEYS.includes(key));
}

/**
 * SPEC: isInterviewComplete
 * Назначение: единая точка знания о том, что 'synthesis' — терминальная фаза
 *   (см. INTERVIEW_PHASE_ORDER) — вызывающий код не должен сравнивать
 *   currentPhase со строковым литералом напрямую.
 * Входы/Выход: профиль (может отсутствовать) → boolean
 * Разрешённые side effects: нет (чистая функция)
 */
export function isInterviewComplete(profile: InterviewProfile | null): boolean {
  return profile?.currentPhase === INTERVIEW_PHASE_ORDER[INTERVIEW_PHASE_ORDER.length - 1];
}

/**
 * SPEC: advancePhaseIfComplete
 * Назначение: перейти к следующей фазе интервью, если текущая фаза больше не
 *   содержит missing-полей (known или deferred — оба считаются закрытыми).
 * Входы/Выход: профиль → InterviewPhase (следующая либо та же самая)
 * Разрешённые side effects: нет (чистая функция)
 * Инварианты: 'synthesis' — последняя фаза, дальше не продвигается.
 */
export function advancePhaseIfComplete(profile: InterviewProfile): InterviewPhase {
  if (missingFieldsInPhase(profile, profile.currentPhase).length > 0) return profile.currentPhase;
  const index = INTERVIEW_PHASE_ORDER.indexOf(profile.currentPhase);
  return INTERVIEW_PHASE_ORDER[index + 1] ?? profile.currentPhase;
}

export interface ProfileFieldUpdate extends ProfileField {
  /** Engine's own judgement that this value conflicts with the currently known one — see applyInterviewUpdate. */
  readonly isContradiction?: boolean;
}

export interface ProfileUpdate {
  readonly fields: ProfileFieldUpdate[];
  readonly openThreads: OpenThread[];
}

export interface MergeResult {
  readonly profile: InterviewProfile;
  readonly contradictions: ProfileField[];
}

const CONTRADICTION_CONFIDENCE_THRESHOLD = 0.6;

/**
 * SPEC: isContradictingKnownField
 * Назначение: решить, конфликтует ли входящее known-обновление с уже known-полем.
 * Входы/Выход: существующее поле (может отсутствовать) + входящее обновление → boolean
 * Разрешённые side effects: нет (чистая функция)
 * Инварианты: см. applyInterviewUpdate — engine-флаг `isContradiction`
 *   первичен и в обе стороны: явный `true` форсирует contradiction, явный
 *   `false` его подавляет — даже если текст всё ещё отличается от старого
 *   значения. Без этого пользователь, разрешающий уточняющий вопрос
 *   ("да, именно X"), не может закрыть contradiction: та же самая
 *   эвристика (различный текст + высокая confidence) снова сработает на
 *   его подтверждающем ответе. Эвристика — запасной путь только когда
 *   engine вообще не высказался (`isContradiction === undefined`).
 */
function isContradictingKnownField(existing: ProfileField | undefined, incoming: ProfileFieldUpdate): boolean {
  if (existing?.status !== 'known' || incoming.status !== 'known') return false;
  if (existing.value === undefined || incoming.value === undefined) return false;
  if (incoming.isContradiction !== undefined) return incoming.isContradiction;
  return incoming.value !== existing.value && (incoming.confidence ?? 1) >= CONTRADICTION_CONFIDENCE_THRESHOLD;
}

/**
 * SPEC: applyInterviewUpdate
 * Назначение: смёржить обновление от interview engine в текущий профиль (correction path).
 * Входы/Выход: текущий InterviewProfile + ProfileUpdate → MergeResult
 * Разрешённые side effects: нет (чистая функция)
 * Инварианты: если для уже known-поля приходит другое known-значение — поле НЕ
 *   перезаписывается молча, а возвращается в contradictions; вызывающий код
 *   обязан спросить пользователя перед merge. Конфликт признаётся либо когда
 *   engine сам явно пометил его (`isContradiction: true` — основной сигнал,
 *   engine видит текущее значение поля в контексте и может сравнить по
 *   смыслу, а не по тексту), либо — как страховка на случай, если engine не
 *   проставил флаг — по старому эвристическому правилу: текстовое различие
 *   значений при confidence >= порога. Полагаться только на текстовое
 *   различие ненадёжно: два независимых LLM-парафраза одного и того же или
 *   двух разных по смыслу ответов легко совпадают или расходятся текстуально
 *   без связи с тем, противоречат ли они друг другу по факту.
 *   openThreads из update заменяют текущие целиком — engine каждый раз
 *   пересчитывает список заново (по всему профилю + последним ходам), это не delta.
 *   currentPhase продвигается на следующую фазу (advancePhaseIfComplete), если
 *   в текущей фазе не осталось missing-полей — известные contradictions это
 *   не блокируют, поле остаётся known со старым значением до ответа пользователя.
 * Запрещено: перезаписывать known-поле без явного подтверждения пользователя.
 */
/**
 * SPEC: fieldsTransitionedToKnown
 * Назначение: назвать поля, которые именно на этом ходу стали known — единица
 *   funnel-анализа "какое поле/тема раскрылись на этом ходу" (см. дашборд,
 *   docs/domain-glossary.md).
 * Входы/Выход: профиль до и после merge → ключи полей, ставших known
 * Разрешённые side effects: нет (чистая функция)
 */
export function fieldsTransitionedToKnown(before: InterviewProfile, after: InterviewProfile): ProfileFieldKey[] {
  const statusBefore = new Map(before.fields.map((field) => [field.key, field.status]));
  return after.fields
    .filter((field) => field.status === 'known' && statusBefore.get(field.key) !== 'known')
    .map((field) => field.key);
}

export function applyInterviewUpdate(current: InterviewProfile, update: ProfileUpdate): MergeResult {
  const contradictions: ProfileField[] = [];
  const fieldsByKey = new Map(current.fields.map((field) => [field.key, field]));

  for (const incoming of update.fields) {
    const existing = fieldsByKey.get(incoming.key);
    if (isContradictingKnownField(existing, incoming)) {
      contradictions.push(incoming);
      continue;
    }
    fieldsByKey.set(incoming.key, incoming);
  }

  const merged: InterviewProfile = {
    userId: current.userId,
    fields: [...fieldsByKey.values()],
    openThreads: update.openThreads,
    currentPhase: current.currentPhase,
    ...(current.displayName !== undefined ? { displayName: current.displayName } : {}),
  };

  return {
    profile: { ...merged, currentPhase: advancePhaseIfComplete(merged) },
    contradictions,
  };
}

function describeFieldForContradiction(key: ProfileFieldKey): string {
  return PROFILE_FIELD_CATALOG.find((field) => field.key === key)?.description ?? key;
}

/**
 * SPEC: describeContradiction
 * Назначение: сформулировать уточняющий вопрос пользователю при конфликте
 *   нового ответа со старым known-значением поля (см. advanceInterview,
 *   вызывается после applyInterviewUpdate).
 * Входы/Выход: профиль до merge + конфликтующее поле (из MergeResult.contradictions) → текст вопроса
 * Разрешённые side effects: нет (чистая функция)
 */
export function describeContradiction(profileBeforeMerge: InterviewProfile, conflict: ProfileField): string {
  const oldValue = profileBeforeMerge.fields.find((field) => field.key === conflict.key)?.value ?? '';
  const newValue = conflict.value ?? '';
  return `Quick check — earlier you said "${oldValue}" about ${describeFieldForContradiction(conflict.key)}, but now it sounds like "${newValue}". Which one is accurate right now?`;
}

const NARRATED_PHASE_COUNT = INTERVIEW_PHASE_ORDER.length - 1; // все, кроме терминальной 'synthesis'

/**
 * SPEC: formatCategoryProgress
 * Назначение: показать пользователю прогресс по текущей фазе интервью, а не
 *   по общему числу вопросов — интервью адаптивное (interviewEngine.v4.md),
 *   один ход может закрыть 0/1/несколько полей, поэтому "вопрос 7 из 25"
 *   расходился бы с реальностью.
 * Входы/Выход: профиль → готовая для показа пользователю строка вида
 *   "Phase 3/5 — History: 2/5"; для терминальной фазы 'synthesis' — пустая
 *   строка (прогресс неактуален, интервью уже завершено).
 * Разрешённые side effects: нет (чистая функция)
 */
export function formatCategoryProgress(profile: InterviewProfile): string {
  const phase = profile.currentPhase;
  if (phase === 'synthesis') return '';

  const total = fieldKeysInPhase(phase).length;
  const closed = total - missingFieldsInPhase(profile, phase).length;
  const phaseIndex = INTERVIEW_PHASE_ORDER.indexOf(phase) + 1;
  return `Phase ${phaseIndex}/${NARRATED_PHASE_COUNT} — ${PHASE_NARRATIVE[phase].label}: ${closed}/${total}`;
}

/**
 * SPEC: appendCategoryProgress
 * Назначение: единая точка склейки текста ответа с прогресс-строкой — общая
 *   для greetNewUser.ts (welcome back) и advanceInterview.ts (суффикс к
 *   ответу интервью), чтобы формат склейки не расходился между двумя местами.
 * Входы/Выход: готовый текст + профиль → текст, при пустом прогрессе (фаза
 *   'synthesis') возвращается без изменений
 * Разрешённые side effects: нет (чистая функция)
 */
export function appendCategoryProgress(text: string, profile: InterviewProfile): string {
  const progress = formatCategoryProgress(profile);
  return progress ? `${text}\n\n${progress}` : text;
}
