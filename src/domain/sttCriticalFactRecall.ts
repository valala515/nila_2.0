// Word-boundary-safe matching (CLAUDE.md §3) — bare substring search would let
// "no" match inside "know" and silently inflate recall. Plain `\b` breaks for
// phrases ending in a non-word character (e.g. "40%"): `\b` needs a word/
// non-word transition, and "%" followed by a space is non-word→non-word, so
// it never matches even when the phrase is right there in the transcript
// (found during the 16 Jul golden benchmark run). Lookaround checks the
// surrounding context directly instead of relying on the phrase's own edge
// characters.
function containsPhrase(transcript: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?<!\\w)${escaped}(?!\\w)`, 'i');
  return pattern.test(transcript);
}

// A fact is either one required phrasing, or a list of interchangeable
// surface forms (e.g. ["34", "thirty-four"], ["40 percent", "40%"]) — STT
// output legitimately varies digit-vs-word and unit-abbreviation formatting
// without losing the underlying fact, and the golden benchmark run on 16 Jul
// showed exact-string matching wrongly counted those as recall failures.
export type CriticalFact = string | readonly string[];

function factLabel(fact: CriticalFact): string {
  return Array.isArray(fact) ? fact.join(' / ') : (fact as string);
}

function isFactPresent(transcript: string, fact: CriticalFact): boolean {
  const alternatives = Array.isArray(fact) ? fact : [fact];
  return alternatives.some((phrase) => containsPhrase(transcript, phrase));
}

export interface CriticalFactRecallResult {
  readonly totalFacts: number;
  readonly foundFacts: string[];
  readonly missingFacts: string[];
  readonly recall: number;
}

/**
 * SPEC: computeCriticalFactRecall
 * Назначение: измерить долю critical facts (отрицания, дозы, числа), которые
 *   уцелели в STT-транскрипте golden-клипа — метрика для voice benchmark
 *   вместо WER (docs/sprint-plan.md, корректировка №2).
 * Входы/Выход: транскрипт + список ожидаемых фактов (фраза либо
 *   взаимозаменяемые варианты фразы) → recall (0..1) + какие факты
 *   найдены/потеряны
 * Разрешённые side effects: нет (чистая функция)
 * Инварианты: recall для пустого списка фактов — 1 (нечего терять); факт
 *   засчитан, если найден хотя бы один из его вариантов
 */
export function computeCriticalFactRecall(transcript: string, criticalFacts: CriticalFact[]): CriticalFactRecallResult {
  const foundFacts = criticalFacts.filter((fact) => isFactPresent(transcript, fact)).map(factLabel);
  const missingFacts = criticalFacts.filter((fact) => !isFactPresent(transcript, fact)).map(factLabel);

  return {
    totalFacts: criticalFacts.length,
    foundFacts,
    missingFacts,
    recall: criticalFacts.length === 0 ? 1 : foundFacts.length / criticalFacts.length,
  };
}
