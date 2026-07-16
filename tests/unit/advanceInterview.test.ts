import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceInterview, type AdvanceInterviewDeps } from '../../src/application/useCases/advanceInterview.js';
import type { InterviewProfile } from '../../src/domain/interviewProfile.js';
import type { InterviewTurnResult } from '../../src/application/ports/interviewEnginePort.js';
import type { TurnRecord } from '../../src/domain/turnRecord.js';

function impactProfileMissingOneField(): InterviewProfile {
  return {
    userId: 'user-1',
    fields: [
      { key: 'severityOrImpact', status: 'known', value: 'a lot', confidence: 0.9 },
      { key: 'activitiesGivenUp', status: 'known', value: 'gym', confidence: 0.9 },
      { key: 'impactOnRelationshipsAndConfidence', status: 'known', value: 'less confidence', confidence: 0.9 },
      { key: 'roleOfProblemNow', status: 'missing' },
    ],
    openThreads: [],
    currentPhase: 'impact',
  };
}

function introProfileWithMissingFields(): InterviewProfile {
  return {
    userId: 'user-1',
    fields: [{ key: 'mainConcern', status: 'known', value: 'back pain', confidence: 0.9 }],
    openThreads: [],
    currentPhase: 'intro',
  };
}

function buildDeps(overrides: {
  profile: InterviewProfile;
  engineResult: InterviewTurnResult;
  reflectCalls: { profile: InterviewProfile; recentTurns: TurnRecord[] }[];
}): AdvanceInterviewDeps {
  return {
    toneAnalysis: { analyzeTone: async () => 'neutral' },
    turnRepository: {
      save: async () => 1,
      listRecent: async () => [],
      countForSession: async () => 1,
    },
    interviewEngine: { advance: async () => overrides.engineResult },
    interviewProfileRepository: {
      load: async () => overrides.profile,
      save: async () => {},
    },
    checkpointReflection: {
      reflect: async (profile, recentTurns) => {
        overrides.reflectCalls.push({ profile, recentTurns });
        return 'CHECKPOINT_REFLECTION_TEXT';
      },
    },
    analyticsEvent: { record: async () => {} },
    pendingFeedback: {
      setPending: async () => {},
      getPending: async () => null,
      clearPending: async () => {},
    },
    session: {
      getOrOpenCurrentSession: async () => 1,
      openNewSession: async () => 1,
      recordUserTurn: async () => {},
      recordBotMessage: async () => {},
    },
  };
}

test('calls checkpoint reflection and uses it as the reply exactly on the impact -> history transition', async () => {
  const reflectCalls: { profile: InterviewProfile; recentTurns: TurnRecord[] }[] = [];
  const deps = buildDeps({
    profile: impactProfileMissingOneField(),
    engineResult: {
      fieldUpdates: [{ key: 'roleOfProblemNow', status: 'known', value: 'central worry', confidence: 0.9 }],
      openThreads: [],
      nextQuestion: 'ENGINE_NEXT_QUESTION',
      flaggedForReview: false,
    },
    reflectCalls,
  });

  const result = await advanceInterview('user-1', 'it takes up all my thoughts', 'text', deps);

  assert.equal(reflectCalls.length, 1);
  assert.equal(result.profile.currentPhase, 'history');
  assert.equal(result.replyText, 'CHECKPOINT_REFLECTION_TEXT');
});

test('does not call checkpoint reflection on a turn that stays within the same phase', async () => {
  const reflectCalls: { profile: InterviewProfile; recentTurns: TurnRecord[] }[] = [];
  const deps = buildDeps({
    profile: introProfileWithMissingFields(),
    engineResult: {
      fieldUpdates: [{ key: 'goal', status: 'known', value: 'move without pain', confidence: 0.9 }],
      openThreads: [],
      nextQuestion: 'ENGINE_NEXT_QUESTION',
      flaggedForReview: false,
    },
    reflectCalls,
  });

  const result = await advanceInterview('user-1', 'I just want to move without pain', 'text', deps);

  assert.equal(reflectCalls.length, 0);
  assert.equal(result.profile.currentPhase, 'intro');
  assert.equal(result.replyText, 'ENGINE_NEXT_QUESTION');
});

test('does not call checkpoint reflection on a phase transition other than impact -> history', async () => {
  const reflectCalls: { profile: InterviewProfile; recentTurns: TurnRecord[] }[] = [];
  const profile: InterviewProfile = {
    userId: 'user-1',
    fields: [
      { key: 'mainConcern', status: 'known', value: 'back pain', confidence: 0.9 },
      { key: 'goal', status: 'known', value: 'move without pain', confidence: 0.9 },
      { key: 'durationOrFrequency', status: 'known', value: 'a few months', confidence: 0.9 },
      { key: 'age', status: 'known', value: '34', confidence: 0.9 },
      { key: 'gender', status: 'known', value: 'female', confidence: 0.9 },
      { key: 'weight', status: 'missing' },
    ],
    openThreads: [],
    currentPhase: 'intro',
  };
  const deps = buildDeps({
    profile,
    engineResult: {
      fieldUpdates: [{ key: 'weight', status: 'deferred', confidence: 1 }],
      openThreads: [],
      nextQuestion: 'ENGINE_NEXT_QUESTION',
      flaggedForReview: false,
    },
    reflectCalls,
  });

  const result = await advanceInterview('user-1', "I'd rather not say", 'text', deps);

  assert.equal(reflectCalls.length, 0);
  assert.equal(result.profile.currentPhase, 'impact');
  assert.equal(result.replyText, 'ENGINE_NEXT_QUESTION');
});

test('offers no quick replies under an ordinary interview question (buttons only on the felt-heard survey)', async () => {
  const deps = buildDeps({
    profile: impactProfileMissingOneField(),
    engineResult: {
      fieldUpdates: [],
      openThreads: [],
      nextQuestion: 'ENGINE_NEXT_QUESTION',
      flaggedForReview: false,
    },
    reflectCalls: [],
  });

  const result = await advanceInterview('user-1', 'tell me more', 'text', deps);

  assert.equal(result.quickReplies, 'none');
});

test('offers experience quick replies and asks how the conversation felt on entering synthesis', async () => {
  const profile: InterviewProfile = {
    userId: 'user-1',
    fields: [
      { key: 'readyToTryNow', status: 'known', value: 'short walks', confidence: 0.9 },
      { key: 'notReadyYet', status: 'known', value: 'running', confidence: 0.9 },
      { key: 'whenNilaCanSuggestActions', status: 'known', value: 'mornings', confidence: 0.9 },
      { key: 'canRevisitSensitiveTopicLater', status: 'known', value: 'yes', confidence: 0.9 },
      { key: 'wantsProactiveMessages', status: 'missing' },
    ],
    openThreads: [],
    currentPhase: 'readiness',
  };
  const deps = buildDeps({
    profile,
    engineResult: {
      fieldUpdates: [{ key: 'wantsProactiveMessages', status: 'known', value: 'yes please', confidence: 0.9 }],
      openThreads: [],
      nextQuestion: 'ENGINE_NEXT_QUESTION',
      flaggedForReview: false,
    },
    reflectCalls: [],
  });

  const result = await advanceInterview('user-1', 'yes, check in with me', 'text', deps);

  assert.equal(result.profile.currentPhase, 'synthesis');
  assert.equal(result.quickReplies, 'experience');
  assert.notEqual(result.replyText, 'ENGINE_NEXT_QUESTION');
});
