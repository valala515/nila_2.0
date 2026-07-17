import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifiedInitData {
  readonly userId: string;
}

const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60;

function computeHash(dataCheckString: string, botToken: string): string {
  // 'WebAppData' — публичная HMAC-константа из протокола Telegram Mini Apps
  // initData (не секрет), см. SPEC verifyInitData ниже.
  // eslint-disable-next-line sonarjs/hardcoded-secret-signatures
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  return createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
}

function hashesMatch(expectedHex: string, actualHex: string): boolean {
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = Buffer.from(actualHex, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function isFresh(authDate: string | null, maxAgeSeconds: number): boolean {
  if (!authDate) return false;
  const ageSeconds = Date.now() / 1000 - Number(authDate);
  return ageSeconds >= 0 && ageSeconds <= maxAgeSeconds;
}

function extractUserId(userJson: string | null): string | null {
  if (!userJson) return null;
  try {
    const user = JSON.parse(userJson) as { id?: unknown };
    return typeof user.id === 'number' || typeof user.id === 'string' ? String(user.id) : null;
  } catch {
    return null;
  }
}

/**
 * SPEC: verifyInitData
 * Назначение: проверить подпись Telegram Mini App initData (Init Data —
 *   Telegram Mini Apps docs) прежде чем доверять userId из запроса к
 *   /api/profile — без этой проверки любой внешний запрос мог бы
 *   представиться чужим userId (CLAUDE.md §5, health-данные).
 * Входы/Выход: сырая query-строка initData + токен бота (+ опционально
 *   maxAgeSeconds, по умолчанию 24ч) → { userId } при валидной и свежей
 *   подписи, иначе null.
 * Разрешённые side effects: нет (чистая функция)
 * Инварианты: hash сравнивается через timingSafeEqual, не строковым `===`,
 *   чтобы не течь через timing side channel; auth_date старше maxAgeSeconds —
 *   тоже null (защита от replay уже скомпрометированной ссылки).
 */
export function verifyInitData(initData: string, botToken: string, maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS): VerifiedInitData | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  if (!hashesMatch(hash, computeHash(dataCheckString, botToken))) return null;
  if (!isFresh(params.get('auth_date'), maxAgeSeconds)) return null;

  const userId = extractUserId(params.get('user'));
  return userId ? { userId } : null;
}
