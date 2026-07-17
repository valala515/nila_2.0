import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyInitData } from '../../src/infrastructure/telegram/initDataValidation.js';

const BOT_TOKEN = 'test-bot-token';

function buildInitData(fields: Record<string, string>): string {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  // 'WebAppData' — публичная HMAC-константа протокола, не секрет (см. initDataValidation.ts).
  // eslint-disable-next-line sonarjs/hardcoded-secret-signatures
  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

test('accepts a validly signed, fresh initData and extracts the numeric userId', () => {
  const initData = buildInitData({
    user: JSON.stringify({ id: 652816998, first_name: 'Valeri' }),
    auth_date: String(Math.floor(Date.now() / 1000)),
  });

  assert.deepEqual(verifyInitData(initData, BOT_TOKEN), { userId: '652816998' });
});

test('rejects initData with a tampered hash', () => {
  const initData = buildInitData({
    user: JSON.stringify({ id: 652816998 }),
    auth_date: String(Math.floor(Date.now() / 1000)),
  }).replace(/hash=[0-9a-f]+/, `hash=${'0'.repeat(64)}`);

  assert.equal(verifyInitData(initData, BOT_TOKEN), null);
});

test('rejects initData signed with a different bot token', () => {
  const initData = buildInitData({
    user: JSON.stringify({ id: 652816998 }),
    auth_date: String(Math.floor(Date.now() / 1000)),
  });

  assert.equal(verifyInitData(initData, 'a-different-bot-token'), null);
});

test('rejects initData older than maxAgeSeconds', () => {
  const staleAuthDate = Math.floor(Date.now() / 1000) - 100_000;
  const initData = buildInitData({
    user: JSON.stringify({ id: 652816998 }),
    auth_date: String(staleAuthDate),
  });

  assert.equal(verifyInitData(initData, BOT_TOKEN, 86_400), null);
});

test('rejects initData missing the hash field entirely', () => {
  const initData = new URLSearchParams({ user: JSON.stringify({ id: 652816998 }) }).toString();

  assert.equal(verifyInitData(initData, BOT_TOKEN), null);
});
