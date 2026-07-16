export type ExperienceRatingChoice = 'up' | 'down';

// Только 👍/👎 (решение пользователя 16 июля после живого теста — 😐 и "✏️
// Edit" убраны, см. docs/sprint-plan.md). Числовая шкала внутри не меняется —
// на неё уже завязан дашборд (North-star gate "Felt understood", см.
// analyticsRepository.ts) — меняется только UX ввода.
export const EXPERIENCE_RATING_SCORE: Record<ExperienceRatingChoice, number> = { up: 5, down: 1 };
