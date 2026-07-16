import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyInterviewUpdate,
  createEmptyProfile,
  onlyDemographicFieldsRemaining,
  fieldsTransitionedToKnown,
  type InterviewProfile,
} from '../../src/domain/interviewProfile.js';

function profileWithKnownGoal(value: string): InterviewProfile {
  return {
    userId: 'user-1',
    fields: [{ key: 'goal', status: 'known', value, confidence: 0.9 }],
    openThreads: [],
    currentPhase: 'intro',
  };
}

test('flags a contradiction when the engine sets isContradiction, even if the paraphrased value happens to match the stored one', () => {
  const current = profileWithKnownGoal('lose weight');

  const { contradictions, profile } = applyInterviewUpdate(current, {
    fields: [{ key: 'goal', status: 'known', value: 'lose weight', confidence: 0.9, isContradiction: true }],
    openThreads: [],
  });

  assert.equal(contradictions.length, 1);
  assert.equal(profile.fields.find((field) => field.key === 'goal')?.value, 'lose weight');
});

test('still flags a contradiction on the old text-diff heuristic when the engine omits isContradiction', () => {
  const current = profileWithKnownGoal('lose weight');

  const { contradictions } = applyInterviewUpdate(current, {
    fields: [{ key: 'goal', status: 'known', value: 'gain muscle', confidence: 0.8 }],
    openThreads: [],
  });

  assert.equal(contradictions.length, 1);
});

test('an explicit isContradiction: false overrides the text-diff heuristic, so a resolved contradiction can actually be applied', () => {
  const current = profileWithKnownGoal('lose weight');

  const { contradictions, profile } = applyInterviewUpdate(current, {
    fields: [{ key: 'goal', status: 'known', value: 'gain muscle', confidence: 0.9, isContradiction: false }],
    openThreads: [],
  });

  assert.equal(contradictions.length, 0, 'engine explicitly said this is not a contradiction — must not fall back to the heuristic');
  assert.equal(profile.fields.find((field) => field.key === 'goal')?.value, 'gain muscle');
});

test('does not flag a contradiction for a low-confidence, unflagged, differently worded update', () => {
  const current = profileWithKnownGoal('lose weight');

  const { contradictions, profile } = applyInterviewUpdate(current, {
    fields: [{ key: 'goal', status: 'known', value: 'gain muscle', confidence: 0.3 }],
    openThreads: [],
  });

  assert.equal(contradictions.length, 0);
  assert.equal(profile.fields.find((field) => field.key === 'goal')?.value, 'gain muscle');
});

test('merges normally when the update agrees with the known field', () => {
  const current = profileWithKnownGoal('lose weight');

  const { contradictions, profile } = applyInterviewUpdate(current, {
    fields: [{ key: 'goal', status: 'known', value: 'lose weight', confidence: 0.95 }],
    openThreads: [],
  });

  assert.equal(contradictions.length, 0);
  assert.equal(profile.fields.find((field) => field.key === 'goal')?.value, 'lose weight');
});

test('starts a fresh profile in the intro phase', () => {
  const profile = createEmptyProfile('user-1');
  assert.equal(profile.currentPhase, 'intro');
});

test('stays in the intro phase while any intro field is still missing', () => {
  const current = createEmptyProfile('user-1');

  const { profile } = applyInterviewUpdate(current, {
    fields: [{ key: 'mainConcern', status: 'known', value: 'back pain', confidence: 0.9 }],
    openThreads: [],
  });

  assert.equal(profile.currentPhase, 'intro');
});

test('advances to the impact phase once every intro field is known or deferred', () => {
  const current = createEmptyProfile('user-1');

  const { profile } = applyInterviewUpdate(current, {
    fields: [
      { key: 'mainConcern', status: 'known', value: 'back pain', confidence: 0.9 },
      { key: 'goal', status: 'known', value: 'move without pain', confidence: 0.9 },
      { key: 'durationOrFrequency', status: 'known', value: 'a few months', confidence: 0.9 },
      { key: 'age', status: 'known', value: '34', confidence: 0.9 },
      { key: 'gender', status: 'known', value: 'female', confidence: 0.9 },
      { key: 'weight', status: 'deferred', confidence: 0.9 },
    ],
    openThreads: [],
  });

  assert.equal(profile.currentPhase, 'impact');
});

test('signals to ask demographics directly once only age/gender/weight remain missing in intro', () => {
  const current = createEmptyProfile('user-1');

  const { profile } = applyInterviewUpdate(current, {
    fields: [
      { key: 'mainConcern', status: 'known', value: 'back pain', confidence: 0.9 },
      { key: 'goal', status: 'known', value: 'move without pain', confidence: 0.9 },
      { key: 'durationOrFrequency', status: 'known', value: 'a few months', confidence: 0.9 },
    ],
    openThreads: [],
  });

  assert.equal(onlyDemographicFieldsRemaining(profile, 'intro'), true);
});

test('does not signal demographics-only while a non-demographic intro field is still missing', () => {
  const profile = createEmptyProfile('user-1');
  assert.equal(onlyDemographicFieldsRemaining(profile, 'intro'), false);
});

test('fieldsTransitionedToKnown reports only fields that newly became known', () => {
  const before = createEmptyProfile('user-1');
  const { profile: after } = applyInterviewUpdate(before, {
    fields: [
      { key: 'mainConcern', status: 'known', value: 'back pain', confidence: 0.9 },
      { key: 'goal', status: 'missing' },
    ],
    openThreads: [],
  });

  assert.deepEqual(fieldsTransitionedToKnown(before, after), ['mainConcern']);
});

test('fieldsTransitionedToKnown ignores a field that was already known before this turn', () => {
  const before = profileWithKnownGoal('lose weight');
  const { profile: after } = applyInterviewUpdate(before, {
    fields: [{ key: 'goal', status: 'known', value: 'lose weight', confidence: 0.95 }],
    openThreads: [],
  });

  assert.deepEqual(fieldsTransitionedToKnown(before, after), []);
});
