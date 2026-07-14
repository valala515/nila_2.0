import * as Sentry from '@sentry/node';
import type { Env } from '../../config/env.js';
import { BUILD_VERSION } from '../../config/version.js';

/**
 * SPEC: initErrorTracking
 * Назначение: инициализировать отправку необработанных ошибок в GlitchTip
 *   (Sentry-совместимый self-hosted трекер), используя @sentry/node как клиент.
 * Входы/Выход: Env → void, либо no-op при пустом GLITCHTIP_DSN (DSN ещё не выдан
 *   backend-командой — см. CLAUDE.md §10 про BUILD_VERSION как release).
 * Разрешённые side effects: Sentry.init (глобальный singleton клиента SDK)
 * Инварианты: sendDefaultPii выключен, тело запроса/ответа не прикрепляется —
 *   raw текст сообщений пользователя и health-контекст не должны попасть в
 *   события (CLAUDE.md §5). Любой будущий Sentry.setContext/captureMessage
 *   обязан передавать только категории/хэши, не сырой текст.
 * Запрещено: включать sendDefaultPii, прикреплять request/response body.
 */
export function initErrorTracking(env: Env): void {
  if (!env.GLITCHTIP_DSN) {
    console.log('GLITCHTIP_DSN не задан — трекер ошибок отключён.');
    return;
  }

  Sentry.init({
    dsn: env.GLITCHTIP_DSN,
    release: BUILD_VERSION,
    environment: env.NODE_ENV,
    sendDefaultPii: false,
  });
}
