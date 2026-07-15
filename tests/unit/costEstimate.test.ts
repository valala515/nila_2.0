import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateLlmCostUsd, estimateSttCostUsd } from '../../src/domain/costEstimate.js';

test('estimateLlmCostUsd prices prompt and completion tokens at gpt-4o-mini rates', () => {
  const cost = estimateLlmCostUsd('gpt-4o-mini', 1_000_000, 1_000_000);
  assert.equal(cost, 0.15 + 0.6);
});

test('estimateLlmCostUsd returns 0 for a zero-token call', () => {
  assert.equal(estimateLlmCostUsd('gpt-4o-mini', 0, 0), 0);
});

test('estimateSttCostUsd prices audio duration at gpt-4o-transcribe per-minute rate', () => {
  const cost = estimateSttCostUsd('gpt-4o-transcribe', 60);
  assert.equal(cost, 0.006);
});

test('estimateSttCostUsd scales linearly with duration', () => {
  const cost = estimateSttCostUsd('gpt-4o-transcribe', 30);
  assert.equal(cost, 0.003);
});
