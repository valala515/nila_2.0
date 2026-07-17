import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getProfileForMiniApp } from '../../src/application/useCases/getProfileForMiniApp.js';
import { createEmptyProfile, type InterviewProfile } from '../../src/domain/interviewProfile.js';
import type { InterviewProfileRepository } from '../../src/application/ports/interviewProfileRepository.js';

function repositoryReturning(profile: InterviewProfile | null): InterviewProfileRepository {
  return {
    load: async () => profile,
    save: async () => {},
  };
}

test('returns null when the user has no profile yet', async () => {
  const result = await getProfileForMiniApp('no-such-user', { interviewProfileRepository: repositoryReturning(null) });

  assert.equal(result, null);
});

test('summarizes phase progress and known facts, omitting missing/deferred fields', async () => {
  const empty = createEmptyProfile('u1', 'Valeri');
  const profile: InterviewProfile = {
    ...empty,
    currentPhase: 'impact',
    fields: empty.fields.map((field) => {
      if (field.key === 'mainConcern') return { key: field.key, status: 'known', value: 'lower back pain' };
      if (field.key === 'weight') return { key: field.key, status: 'deferred' };
      if (field.key === 'severityOrImpact') return { key: field.key, status: 'known', value: 'hard to sit at work' };
      return field;
    }),
  };

  const result = await getProfileForMiniApp('u1', { interviewProfileRepository: repositoryReturning(profile) });

  assert.ok(result);
  assert.equal(result.displayName, 'Valeri');
  assert.equal(result.currentPhase, 'impact');
  assert.equal(result.interviewComplete, false);

  const intro = result.phases.find((phase) => phase.key === 'intro');
  assert.ok(intro);
  assert.equal(intro.isDone, true);
  assert.equal(intro.isCurrent, false);
  // 2, not 1: closedFields counts known+deferred (weight is deferred here, still "closed").
  assert.equal(intro.closedFields, 2);

  const impact = result.phases.find((phase) => phase.key === 'impact');
  assert.ok(impact);
  assert.equal(impact.isCurrent, true);
  assert.equal(impact.isDone, false);
  assert.equal(impact.closedFields, 1);

  assert.deepEqual(
    result.facts.map((fact) => fact.key),
    ['mainConcern', 'severityOrImpact'],
  );
  assert.equal(result.facts[0]?.value, 'lower back pain');
  assert.equal(result.facts[0]?.description.length > 0, true);
});

test('omits displayName entirely when the profile has none', async () => {
  const profile = createEmptyProfile('u2');

  const result = await getProfileForMiniApp('u2', { interviewProfileRepository: repositoryReturning(profile) });

  assert.ok(result);
  assert.equal('displayName' in result, false);
});

test('marks interviewComplete once the profile reaches the terminal synthesis phase', async () => {
  const profile: InterviewProfile = { ...createEmptyProfile('u3'), currentPhase: 'synthesis' };

  const result = await getProfileForMiniApp('u3', { interviewProfileRepository: repositoryReturning(profile) });

  assert.ok(result);
  assert.equal(result.interviewComplete, true);
});
