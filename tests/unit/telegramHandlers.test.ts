import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isChatAllowed } from '../../src/transport/telegramHandlers.js';

test('isChatAllowed passes everyone through when the allowlist is empty', () => {
  assert.equal(isChatAllowed('652816998', new Set()), true);
});

test('isChatAllowed passes a chat id that is in a non-empty allowlist', () => {
  assert.equal(isChatAllowed('652816998', new Set(['652816998'])), true);
});

test('isChatAllowed blocks a chat id that is not in a non-empty allowlist', () => {
  assert.equal(isChatAllowed('999999999', new Set(['652816998'])), false);
});
