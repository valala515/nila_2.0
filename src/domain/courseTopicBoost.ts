// Hand-tuned query-intent boosts layered on top of the tiered keyword score.
// Ported from ai_agent_chat's buildTopicBoost (courseService.js) — each rule
// documents a specific query pattern the team tuned against real catalog
// titles. Split into one small function per rule (vs. the original single
// ~80-line function) to keep cyclomatic complexity per function low
// (CLAUDE.md §4) — buildTopicBoost itself just sums the rules.
import { hasWord, hasAnyWord } from './courseQuery.js';

export interface CourseBoostSignals {
  readonly title: string;
  readonly excerpt: string;
}

type BoostRule = (course: CourseBoostSignals, query: string) => number;

function morningRoutineBoost(course: CourseBoostSignals, query: string): number {
  if (!(hasWord(query, 'morning') && hasWord(query, 'routine'))) return 0;
  const titleExcerpt = `${course.title} ${course.excerpt}`;
  let boost = 0;
  if (hasWord(course.title, 'morning')) boost += 5;
  if (hasWord(titleExcerpt, 'routine')) boost += 2;
  if (hasAnyWord(course.title, ['spine', 'back', 'pain', 'face', 'sensual', 'men'])) boost -= 1.5;
  return boost;
}

function sleepBoost(course: CourseBoostSignals, query: string): number {
  if (!hasAnyWord(query, ['sleep', 'sleeping', 'insomnia', 'bedtime'])) return 0;
  const titleExcerpt = `${course.title} ${course.excerpt}`;
  return hasAnyWord(titleExcerpt, ['sleep', 'insomnia', 'nidra', 'bedtime']) ? 3 : 0;
}

function stressBoost(course: CourseBoostSignals, query: string): number {
  if (!hasAnyWord(query, ['stress', 'anxiety', 'anxious', 'cortisol', 'calm'])) return 0;
  const titleExcerpt = `${course.title} ${course.excerpt}`;
  return hasAnyWord(titleExcerpt, ['stress', 'anxiety', 'cortisol', 'nervous', 'calm']) ? 3 : 0;
}

function fitnessBoost(course: CourseBoostSignals, query: string): number {
  if (!hasAnyWord(query, ['fitness', 'exercise', 'exercises', 'workout', 'workouts'])) return 0;
  const titleExcerpt = `${course.title} ${course.excerpt}`;
  return hasAnyWord(titleExcerpt, ['fitness', 'exercise', 'workout', 'home', 'strength']) ? 3 : 0;
}

function energyNutritionBoost(course: CourseBoostSignals, query: string): number {
  const titleExcerpt = `${course.title} ${course.excerpt}`;
  let boost = 0;
  if (hasWord(query, 'energy') && hasAnyWord(query, ['nutrition', 'eat', 'food', 'diet'])) {
    if (hasWord(titleExcerpt, 'energy') && hasAnyWord(titleExcerpt, ['gut', 'nutrition', 'food', 'digest', 'digestion'])) {
      boost += 5;
    }
  }
  if (hasAnyWord(course.title, ['weight', 'fat', 'slim', 'loss']) && !hasAnyWord(query, ['weight', 'fat', 'slim', 'loss'])) {
    boost -= 3;
  }
  return boost;
}

function nutritionBoost(course: CourseBoostSignals, query: string): number {
  const asksNutrition = hasAnyWord(query, [
    'nutrition', 'gut', 'digestion', 'digest', 'bloating', 'bloat', 'inflammation', 'eating', 'greens', 'meal', 'healthy',
  ]);
  if (!asksNutrition) return 0;
  const titleExcerpt = `${course.title} ${course.excerpt}`;
  const aligned = hasAnyWord(titleExcerpt, [
    'nutrition', 'gut', 'digestion', 'bloating', 'inflammation', 'diet', 'food', 'eating', 'cook', 'cooking', 'meal', 'nourish',
  ]);
  return aligned ? 5 : 0;
}

function backPainBoost(course: CourseBoostSignals, query: string): number {
  const asksBackPain = (hasWord(query, 'back') && hasAnyWord(query, ['pain', 'ache', 'hurt'])) || hasWord(query, 'spine');
  if (!asksBackPain) return 0;
  let boost = 0;
  if (hasAnyWord(course.title, ['back', 'spine'])) boost += 5;
  if (hasAnyWord(course.title, ['hip', 'knee']) && !hasAnyWord(query, ['hip', 'knee'])) boost -= 2;
  return boost;
}

function voiceBoost(course: CourseBoostSignals, query: string): number {
  if (!hasAnyWord(query, ['voice', 'vocal', 'sing', 'singing'])) return 0;
  let boost = 0;
  if (hasAnyWord(course.title, ['voice', 'vocal'])) boost += 5;
  if (hasWord(course.title, 'singing')) boost += 1;
  if (hasAnyWord(course.title, ['sound', 'bowl', 'bowls']) && !hasAnyWord(query, ['sound', 'bowl', 'bowls', 'headache'])) {
    boost -= 2;
  }
  return boost;
}

function isSomaticQuery(query: string): boolean {
  return (
    hasAnyWord(query, ['somatic', 'dance', 'embodiment', 'inner energy', 'grounding', 'expressive']) ||
    (hasAnyWord(query, ['inner', 'reconnect']) && hasAnyWord(query, ['movement', 'dance', 'energy']))
  );
}

// Penalize back/neck/pain-relief courses for somatic queries that never
// mentioned pain — a somatic/inner-energy query shouldn't surface a pure
// back-pain course just because "movement" appears in both.
function isBackNeckReliefCourse(course: CourseBoostSignals): boolean {
  const titleExcerpt = `${course.title} ${course.excerpt}`;
  if (/\b(back|neck|spine)\b/i.test(course.title)) return true;
  return /\b(relief|pain)\b/i.test(course.title) && /\b(back|neck|spine|shoulder)\b/i.test(titleExcerpt);
}

function somaticMovementBoost(course: CourseBoostSignals, query: string): number {
  if (!isSomaticQuery(query)) return 0;

  const queryMentionsPain = hasAnyWord(query, ['pain', 'ache', 'hurt', 'relief', 'back', 'neck', 'spine', 'injury', 'stiff', 'posture']);
  let boost = 0;
  if (hasAnyWord(course.title, ['somatic', 'dance', 'embodiment'])) boost += 6;
  if (!queryMentionsPain) {
    if (hasAnyWord(course.title, ['movement', 'flow'])) boost += 3;
    if (isBackNeckReliefCourse(course)) boost -= 6;
  }
  return boost;
}

const BOOST_RULES: BoostRule[] = [
  morningRoutineBoost,
  sleepBoost,
  stressBoost,
  fitnessBoost,
  energyNutritionBoost,
  nutritionBoost,
  backPainBoost,
  voiceBoost,
  somaticMovementBoost,
];

/**
 * SPEC: buildTopicBoost
 * Назначение: применить набор точечных эвристик, подобранных под реальные
 *   запросы (утренняя рутина, сон, стресс, фитнес, энергия+питание, боль в
 *   спине, голос, соматика/движение) поверх базового tiered-скора.
 * Входы/Выход: сигналы курса (title/excerpt) + сырой запрос пользователя → число (может быть отрицательным)
 * Разрешённые side effects: нет (чистая функция)
 */
export function buildTopicBoost(course: CourseBoostSignals, userMessage: string): number {
  const query = userMessage.toLowerCase();
  return BOOST_RULES.reduce((sum, rule) => sum + rule(course, query), 0);
}
