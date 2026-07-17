import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestModeInterviewEngine } from '../../src/infrastructure/testing/testModeInterviewEngine.js';
import { createEmptyProfile } from '../../src/domain/interviewProfile.js';
import type { InterviewEnginePort } from '../../src/application/ports/interviewEnginePort.js';

const unusedRealEngine: InterviewEnginePort = {
  advance: () => {
    throw new Error('real engine should not be called for an allowlisted userId');
  },
};

test('fills the first missing field of the current phase for an allowlisted userId, regardless of the answer text', async () => {
  const engine = createTestModeInterviewEngine(unusedRealEngine, ['652816998']);
  const profile = createEmptyProfile('652816998');

  const result = await engine.advance({ userAnswer: 'okay', profile, recentTurns: [], tone: 'neutral' });

  assert.equal(result.fieldUpdates.length, 1);
  assert.equal(result.fieldUpdates[0].key, 'mainConcern');
  assert.equal(result.fieldUpdates[0].status, 'known');
  assert.equal(result.flaggedForReview, false);
});

test('delegates to the real engine for a userId not on the allowlist', async () => {
  const realEngine: InterviewEnginePort = {
    advance: async () => ({ fieldUpdates: [], openThreads: [], nextQuestion: 'REAL_ENGINE_QUESTION', flaggedForReview: false }),
  };
  const engine = createTestModeInterviewEngine(realEngine, ['652816998']);
  const profile = createEmptyProfile('some-other-user');

  const result = await engine.advance({ userAnswer: 'hello', profile, recentTurns: [], tone: 'neutral' });

  assert.equal(result.nextQuestion, 'REAL_ENGINE_QUESTION');
});
