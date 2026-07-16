// Seed vocabulary list for STT prompting (docs/sprint-plan.md, Wed 15 Jul —
// "glossary/keyterms в STT-запросе"). Deliberately small and flat: this is a
// first-pass hint list, not a finalized medical vocabulary — extend as real
// dogfood transcripts surface recurring misrecognitions.
export const STT_GLOSSARY_TERMS: readonly string[] = [
  'metformin',
  'sertraline',
  'ibuprofen',
  'melatonin',
  'binge eating',
  'emotional eating',
  'intermittent fasting',
  'HRV',
  'recovery score',
];

/**
 * SPEC: buildSttPrompt
 * Назначение: собрать текстовую подсказку для gpt-4o-transcribe (`prompt`
 *   параметр) из glossary — модель охотнее правильно расслышит термины,
 *   встреченные в подсказке.
 * Входы/Выход: нет входов → строка-подсказка
 * Разрешённые side effects: нет (чистая функция)
 */
export function buildSttPrompt(): string {
  return `Vocabulary that may appear: ${STT_GLOSSARY_TERMS.join(', ')}.`;
}
