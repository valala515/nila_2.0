import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PROMPTS_DIR = fileURLToPath(new URL('../../../prompts/', import.meta.url));
const cache = new Map<string, string>();

/**
 * SPEC: loadPrompt
 * Назначение: прочитать версионированный промпт из prompts/ по имени файла
 * Входы/Выход: имя файла (например 'interviewEngine.v1.md') → его текстовое содержимое
 * Разрешённые side effects: чтение файла с диска (один раз на имя, дальше из кэша)
 * Инварианты: промпты не встраиваются как inline-строки в код (CLAUDE.md §6)
 */
export function loadPrompt(fileName: string): string {
  const cached = cache.get(fileName);
  if (cached !== undefined) return cached;

  const content = readFileSync(`${PROMPTS_DIR}${fileName}`, 'utf-8');
  cache.set(fileName, content);
  return content;
}
