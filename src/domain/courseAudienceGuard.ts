// Audience guard — excludes courses targeted at an audience segment that
// conflicts with what's known about the user (kids/women/men/elderly courses).
// Ported as-is from ai_agent_chat's passesAudienceGuard (courseService.js) —
// each regex was tuned against real catalog titles to avoid false positives
// (e.g. MEN_COURSE_RE checked on title+excerpt only, not body, so a general
// hormone-health course mentioning "testosterone" once doesn't get excluded
// from women's results).

export interface UserAudienceProfile {
  readonly hasKids?: boolean;
  readonly gender?: 'male' | 'female' | 'non-binary' | 'prefer_not';
  readonly ageGroup?: 'under30' | '30s' | '40s' | '50plus';
}

export interface CourseAudienceSignals {
  readonly title: string;
  readonly excerpt: string;
  readonly body: string | null;
}

// Split across two regexes (vs. one large alternation) to stay under the
// sonarjs regex-complexity limit — behavior is the same "match any of these
// words" check as ai_agent_chat's single CHILD_COURSE_RE.
const CHILD_COURSE_RE_TERMS =
  /\b(kids?|children|child|baby|babies|toddler|newborn|infant)\b/i;
const CHILD_COURSE_RE_LIFECYCLE =
  /\b(pregnancy|pregnant|maternal|prenatal|postnatal|montessori|mama|mamas|postpartum|birth(?:ing)?)\b/i;
const CHILD_QUERY_RE =
  /\b(kids?|children|child|baby|babies|toddler|newborn|infant|son|daughter|pregnancy|pregnant|mama|postpartum)\b/i;
const WOMEN_COURSE_RE = /\bfeminine\b|\bgoddess\b|\bshakti\b|\byoni\b|\bwomen\b|\bwoman\b/i;
const MEN_COURSE_RE = /\bmen'?s\s+(health|kegel)\b|\blingam\s+massage\s+course\b|\berectile\b|\btestosterone\b/i;
const ELDERLY_COURSE_RE =
  /\b(?:50|60|70|45)\+|\baging\b|anti[- ]aging|reverse\s+aging|\blongevity\b|\bsenior\b|\bmenopause\b|after\s+(?:40|45)\b/i;

function isChildCourse(title: string): boolean {
  return CHILD_COURSE_RE_TERMS.test(title) || CHILD_COURSE_RE_LIFECYCLE.test(title);
}

export function detectsChildQuery(query: string): boolean {
  return CHILD_QUERY_RE.test(query);
}

function childGuardResult(course: CourseAudienceSignals, userProfile: UserAudienceProfile, userAsksAboutChild: boolean): boolean | null {
  if (!isChildCourse(course.title)) return null;
  return userAsksAboutChild || userProfile.hasKids === true;
}

function menGuardResult(titleExcerpt: string, userProfile: UserAudienceProfile): boolean | null {
  if (!MEN_COURSE_RE.test(titleExcerpt)) return null;
  const gender = userProfile.gender;
  return !(gender === 'female' || gender === 'non-binary' || gender === 'prefer_not');
}

function womenGuardResult(titleExcerpt: string, userProfile: UserAudienceProfile): boolean | null {
  if (!WOMEN_COURSE_RE.test(titleExcerpt)) return null;
  return !(userProfile.gender === 'male' || userProfile.gender === 'prefer_not');
}

function elderlyGuardResult(hay: string, userProfile: UserAudienceProfile): boolean | null {
  if (!ELDERLY_COURSE_RE.test(hay)) return null;
  const ageGroup = userProfile.ageGroup;
  if (!ageGroup) return true;
  return !(ageGroup === 'under30' || ageGroup === '30s');
}

/**
 * SPEC: passesAudienceGuard
 * Назначение: решить, показывать ли курс пользователю с известным профилем —
 *   курсы для другого сегмента (дети/женщины/мужчины/50+) скрываются, если
 *   профиль пользователя явно им не соответствует.
 * Входы/Выход: сигналы курса + профиль пользователя + упоминул ли запрос
 *   ребёнка → boolean (true = показывать)
 * Разрешённые side effects: нет (чистая функция)
 * Инварианты: неизвестное поле профиля (undefined) всегда пропускает курс —
 *   guard срабатывает только на явном конфликте, не на отсутствии данных.
 *   Проверки идут в фиксированном порядке (ребёнок → мужчины → женщины →
 *   50+) и останавливаются на первом применимом сегменте — курс не может
 *   попасть больше чем под один guard.
 */
export function passesAudienceGuard(
  course: CourseAudienceSignals,
  userProfile: UserAudienceProfile = {},
  userAsksAboutChild = false,
): boolean {
  const titleExcerpt = `${course.title} ${course.excerpt}`;
  const hay = `${titleExcerpt} ${course.body ?? ''}`;

  const result =
    childGuardResult(course, userProfile, userAsksAboutChild) ??
    menGuardResult(titleExcerpt, userProfile) ??
    womenGuardResult(titleExcerpt, userProfile) ??
    elderlyGuardResult(hay, userProfile);

  return result ?? true;
}
