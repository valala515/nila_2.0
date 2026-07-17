import { z } from 'zod';

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  DATABASE_PATH: z.string().min(1).default('./data/nila.sqlite'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GLITCHTIP_DSN: z.string().optional().default(''),
  DASHBOARD_TOKEN: z.string().min(1, 'DASHBOARD_TOKEN is required'),
  DASHBOARD_PORT: z.coerce.number().int().positive().default(3001),
  DASHBOARD_STATIC_DIR: z.string().min(1).default('./dashboard/dist'),
  // Только для ручного QA живого интервью в Telegram (см.
  // infrastructure/testing/testModeInterviewEngine.ts) — allowlisted userId
  // может пройти всё интервью любыми ответами, минуя реальный OpenAI-движок.
  // Пусто по умолчанию — обычные пользователи не затронуты.
  INTERVIEW_TEST_MODE_USER_IDS: z
    .string()
    .optional()
    .default('')
    .transform((value) => value.split(',').map((id) => id.trim()).filter(Boolean)),
  // Статика Telegram Mini App экрана профиля (src/transport/miniapp, см.
  // getProfileForMiniApp.ts) — рукописные HTML/CSS/JS, без сборки, поэтому
  // путь смотрит прямо в miniapp/public, а не в dist-каталог, в отличие от
  // DASHBOARD_STATIC_DIR (там отдельный Vite-проект).
  MINIAPP_STATIC_DIR: z.string().min(1).default('./miniapp/public'),
  // Публичный https-URL для Menu Button (web_app) — обычно dev-туннель
  // (cloudflared/ngrok) на этапе разработки. Пусто по умолчанию — Menu Button
  // остаётся обычной (без web_app), сам /api/profile при этом всё равно
  // доступен и тестируем напрямую (graceful degradation).
  TELEGRAM_WEBAPP_URL: z.string().optional().default(''),
});

export type Env = z.infer<typeof envSchema>;

/**
 * SPEC: loadEnv
 * Назначение: провалидировать переменные окружения при старте процесса
 * Входы/Выход: process.env → типизированный Env, либо процесс не стартует
 * Разрешённые side effects: process.exit(1) при невалидной конфигурации
 * Инварианты: любой другой модуль импортирует Env, а не process.env напрямую
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    console.error('Invalid environment configuration:');
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
}
