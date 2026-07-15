// Прайсинг OpenAI на июль 2026 (platform.openai.com/docs/pricing) — источник
// правды для Cost per completed session. При смене модели/цены обновить здесь,
// не в местах вызова.
const LLM_PRICING_USD_PER_MILLION_TOKENS = {
  'gpt-4o-mini': { prompt: 0.15, completion: 0.6 },
} as const;

const STT_PRICING_USD_PER_MINUTE = {
  'gpt-4o-transcribe': 0.006,
} as const;

export type LlmModel = keyof typeof LLM_PRICING_USD_PER_MILLION_TOKENS;
export type SttModel = keyof typeof STT_PRICING_USD_PER_MINUTE;

/**
 * SPEC: estimateLlmCostUsd
 * Назначение: оценить стоимость одного chat completion вызова по токенам usage.
 * Входы/Выход: модель + promptTokens + completionTokens → доллары (число)
 * Разрешённые side effects: нет (чистая функция)
 */
export function estimateLlmCostUsd(model: LlmModel, promptTokens: number, completionTokens: number): number {
  const pricing = LLM_PRICING_USD_PER_MILLION_TOKENS[model];
  return (promptTokens * pricing.prompt + completionTokens * pricing.completion) / 1_000_000;
}

/**
 * SPEC: estimateSttCostUsd
 * Назначение: оценить стоимость одного STT-вызова по длительности аудио.
 * Входы/Выход: модель + длительность в секундах → доллары (число)
 * Разрешённые side effects: нет (чистая функция)
 */
export function estimateSttCostUsd(model: SttModel, audioDurationSec: number): number {
  return (audioDurationSec / 60) * STT_PRICING_USD_PER_MINUTE[model];
}
