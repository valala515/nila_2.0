// Query normalization for course matching — tokenize, strip stop words,
// stem, and expand via synonyms. Ported from ai_agent_chat's courseService.js
// (STOP_WORDS, stems, expandWord, matchesHaystack) with the multilingual
// synonym path dropped (see courseSynonyms.ts).
import { COURSE_SYNONYMS } from './courseSynonyms.js';

// High-frequency words that appear in almost every course description and
// carry no topical signal — discarding them prevents false-positive matches.
export const STOP_WORDS = new Set([
  'that', 'this', 'with', 'have', 'from', 'they', 'will', 'what', 'when', 'more',
  'also', 'about', 'your', 'just', 'like', 'very', 'some', 'been', 'want', 'need',
  'feel', 'help', 'make', 'know', 'think', 'time', 'good', 'better', 'really',
  'does', 'into', 'their', 'there', 'these', 'those', 'then', 'than', 'them',
  'each', 'much', 'many', 'most', 'here', 'over', 'such', 'only', 'even', 'back',
  'both', 'well', 'long', 'able', 'find', 'give', 'live', 'move', 'work', 'take',
  'come', 'ways', 'made', 'used', 'life', 'body', 'mind', 'self', 'every', 'while',
  // Generic action verbs — appear in nearly every course description
  'start', 'begin', 'learn', 'become', 'improve', 'practice', 'discover', 'explore',
  'build', 'join', 'stop', 'keep', 'show', 'goes', 'lets', 'gets', 'puts', 'manage',
  // Intensifiers / qualifiers — add zero topical signal
  'level', 'levels', 'completely', 'totally', 'fully', 'highly', 'focused', 'specific', 'particular', 'exactly', 'especially',
  // Filler words with no topical signal
  'little', 'sometimes', 'would', 'often', 'quite', 'still', 'always', 'never',
  'maybe', 'things', 'other', 'thing', 'could', 'should', 'today',
  'right', 'please', 'thank', 'something', 'anything', 'everything', 'nothing',
  'can', 'recommend', 'recommends', 'recommended', 'recommendation', 'recommendations',
  'option', 'options', 'card', 'cards', 'found', 'below',
  // Navigational intent words — tell us HOW to find, not WHAT to find
  'course', 'courses', 'program', 'programs', 'class', 'classes', 'video', 'videos',
  'consistent', 'consistency',
]);

const STEM_SUFFIXES = ['ing', 'tion', 'ness', 'ment', 'ful', 'ily', 'ly', 'er', 'ed', 'es', 's'];

/**
 * SPEC: stems
 * Назначение: сгенерировать варианты слова без суффикса, чтобы "sleeping" тоже
 *   матчился как "sleep" при поиске по каталогу.
 * Входы/Выход: одно слово → массив вариантов (включая исходное)
 * Разрешённые side effects: нет (чистая функция)
 */
export function stems(word: string): string[] {
  const variants = new Set([word]);
  for (const suffix of STEM_SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 4) {
      variants.add(word.slice(0, -suffix.length));
    }
  }
  return [...variants];
}

/**
 * SPEC: expandWord
 * Назначение: расширить одно слово запроса до множества терминов для поиска —
 *   стемы + синонимы каждого стема.
 * Входы/Выход: слово → массив терминов (уникальных)
 * Разрешённые side effects: нет (чистая функция)
 */
export function expandWord(word: string): string[] {
  const base = stems(word);
  const all = new Set(base);
  for (const variant of base) {
    (COURSE_SYNONYMS[variant] ?? []).forEach((synonym) => all.add(synonym));
  }
  return [...all];
}

/**
 * SPEC: tokenizeQuery
 * Назначение: превратить сырое сообщение пользователя в список уникальных
 *   значимых слов для поиска курсов.
 * Входы/Выход: сырой текст → массив слов (≥3 символов, без стоп-слов, без дублей)
 * Разрешённые side effects: нет (чистая функция)
 */
export function tokenizeQuery(message: string): string[] {
  const words = message
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
  return [...new Set(words)];
}

// \bword\b on both sides — a prefix-only match ("rest" matching "restore",
// "restful") outranked genuinely relevant sleep courses in ai_agent_chat.
export function matchesHaystack(haystack: string, variants: string[]): boolean {
  return variants.some((variant) => hasWord(haystack, variant));
}

export function hasWord(haystack: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return new RegExp(`\\b${escaped}\\b`, 'i').test(haystack);
  } catch {
    return haystack.toLowerCase().includes(word);
  }
}

export function hasAnyWord(haystack: string, words: string[]): boolean {
  return words.some((word) => hasWord(haystack, word));
}
