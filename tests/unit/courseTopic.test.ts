import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCourseTopics, detectQueryTopics } from '../../src/domain/courseTopic.js';

test('classifyCourseTopics: title match is sufficient — single mention counts', () => {
  const topics = classifyCourseTopics('Spine, Hip, Shoulder Mobility', 'Gentle daily warmup routine.');
  assert.ok(topics.includes('movement_mobility'), `Expected movement_mobility. Got: ${topics.join(', ')}`);
  assert.ok(topics.includes('pain_recovery'), `Expected pain_recovery. Got: ${topics.join(', ')}`);
});

test('classifyCourseTopics: a single incidental body mention is not enough', () => {
  const body = 'This yoga flow also touches briefly on nutrition in one step, then moves on to stretching.';
  const topics = classifyCourseTopics('Yoga for Back Relief', body);
  assert.ok(!topics.includes('nutrition_gut'), `Single incidental mention should not classify as nutrition_gut. Got: ${topics.join(', ')}`);
  assert.ok(topics.includes('movement_mobility'));
  assert.ok(topics.includes('pain_recovery'));
});

test('classifyCourseTopics: two distinct body mentions do count', () => {
  const body = 'Learn how nutrition supports digestion, and how better nutrition choices reduce bloating over time.';
  const topics = classifyCourseTopics('A Course About Something Else', body);
  assert.ok(topics.includes('nutrition_gut'), `Expected nutrition_gut from repeated body mentions. Got: ${topics.join(', ')}`);
});

test('detectQueryTopics: maps query words to their topic clusters', () => {
  const topics = detectQueryTopics(['sleep', 'trouble']);
  assert.ok(topics.has('sleep_rest'));
  assert.equal(topics.size, 1);
});

test('detectQueryTopics: unrelated words yield an empty set', () => {
  const topics = detectQueryTopics(['completely', 'unrelated']);
  assert.equal(topics.size, 0);
});
