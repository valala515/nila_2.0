import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCriticalFactRecall } from '../../src/domain/sttCriticalFactRecall.js';

test('computeCriticalFactRecall finds all facts present in the transcript', () => {
  const result = computeCriticalFactRecall('I take 200mg of sertraline every morning', ['200mg', 'sertraline']);

  assert.equal(result.recall, 1);
  assert.deepEqual(result.missingFacts, []);
});

test('computeCriticalFactRecall flags a dropped negation as missing', () => {
  const result = computeCriticalFactRecall('I take metformin anymore', ["don't", 'metformin']);

  assert.equal(result.recall, 0.5);
  assert.deepEqual(result.missingFacts, ["don't"]);
});

test('computeCriticalFactRecall uses word boundaries, not bare substring match', () => {
  const result = computeCriticalFactRecall('I know the risks', ['no']);

  assert.equal(result.recall, 0);
  assert.deepEqual(result.missingFacts, ['no']);
});

test('computeCriticalFactRecall is case-insensitive', () => {
  const result = computeCriticalFactRecall('I have Never tried therapy', ['never']);

  assert.equal(result.recall, 1);
});

test('computeCriticalFactRecall returns recall 1 for an empty fact list', () => {
  const result = computeCriticalFactRecall('anything at all', []);

  assert.equal(result.recall, 1);
  assert.equal(result.totalFacts, 0);
});

test('computeCriticalFactRecall counts a fact found via any of its alternative phrasings', () => {
  const result = computeCriticalFactRecall('I lost about eight pounds', [['8 pounds', 'eight pounds']]);

  assert.equal(result.recall, 1);
  assert.deepEqual(result.missingFacts, []);
});

test('computeCriticalFactRecall matches a phrase ending in a non-word character like "%"', () => {
  const result = computeCriticalFactRecall('My recovery score dropped to 40% last week', ['40%']);

  assert.equal(result.recall, 1);
});

test('computeCriticalFactRecall marks an alternatives fact missing when none of its phrasings match', () => {
  const result = computeCriticalFactRecall('I lost some weight', [['8 pounds', 'eight pounds']]);

  assert.equal(result.recall, 0);
  assert.deepEqual(result.missingFacts, ['8 pounds / eight pounds']);
});
