// Freshness score — newer courses rank slightly higher, all else equal.
// Ported from ai_agent_chat's courseFreshness/rebuildFreshnessCache
// (courseService.js), but as pure functions over an explicit range instead of
// mutable module-level cache state (recomputed once per rankCourses call from
// the full course list passed in, same cost as the legacy cache rebuild).
export interface FreshnessRange {
  readonly maxId: number;
  readonly minCreatedAt: number;
  readonly maxCreatedAt: number;
}

interface FreshnessSignals {
  readonly id: number;
  readonly createdAt: string | null;
}

export function computeFreshnessRange(courses: readonly FreshnessSignals[]): FreshnessRange {
  let maxId = 0;
  const timestamps: number[] = [];
  for (const course of courses) {
    if (course.id > maxId) maxId = course.id;
    const parsed = parseCreatedAt(course.createdAt);
    if (parsed !== null) timestamps.push(parsed);
  }
  return {
    maxId,
    minCreatedAt: timestamps.length ? Math.min(...timestamps) : 0,
    maxCreatedAt: timestamps.length ? Math.max(...timestamps) : 0,
  };
}

/**
 * SPEC: courseFreshness
 * Назначение: небольшой бонус (0–0.5) более новым курсам — по дате создания,
 *   либо по id, если у курса нет валидной даты.
 * Входы/Выход: сигналы курса + диапазон свежести по всему каталогу → число [0, 0.5]
 * Разрешённые side effects: нет (чистая функция)
 */
export function courseFreshness(course: FreshnessSignals, range: FreshnessRange): number {
  const createdAt = parseCreatedAt(course.createdAt);
  if (range.maxCreatedAt > range.minCreatedAt && createdAt !== null) {
    return ((createdAt - range.minCreatedAt) / (range.maxCreatedAt - range.minCreatedAt)) * 0.5;
  }
  return range.maxId > 0 ? (course.id / range.maxId) * 0.5 : 0;
}

function parseCreatedAt(createdAt: string | null): number | null {
  if (!createdAt) return null;
  const parsed = new Date(createdAt).getTime();
  return !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
}
