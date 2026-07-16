/**
 * Regression tests for rankCourses (src/domain/courseRecommendation.ts).
 * Each case documents a specific failure mode ai_agent_chat hit and fixed in
 * its findRelevantCourses (courseService.js) — ported here against a small
 * deterministic fixture catalog instead of the real synced catalog, so these
 * tests don't depend on live NMS data or network access (CLAUDE.md §8).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankCourses } from '../../src/domain/courseRecommendation.js';
import { classifyCourseTopics } from '../../src/domain/courseTopic.js';
import type { Course } from '../../src/domain/course.js';

function course(partial: Pick<Course, 'id' | 'title'> & Partial<Course>): Course {
  const excerpt = partial.excerpt ?? '';
  const body = partial.body ?? null;
  return {
    slug: `course-${partial.id}`,
    author: null,
    rating: null,
    ratingCount: null,
    thumbUrl: null,
    excerpt,
    body,
    lessonTitles: [],
    lessonsCount: null,
    courseFocus: null,
    lang: 'en',
    createdAt: null,
    ...partial,
    topics: partial.topics ?? classifyCourseTopics(`${partial.title} ${excerpt}`, body ?? ''),
  };
}

const CATALOG: Course[] = [
  course({
    id: 1,
    title: 'Warmup Mobility: Spine, Hip, Shoulder Mobility',
    excerpt: 'A gentle daily mobility routine to loosen the spine, hips, and shoulders before rehab or exercise.',
  }),
  course({
    id: 2,
    title: 'Emotional Release & Somatic Flow',
    excerpt: 'Release muscle tension through somatic movement and gentle stress relief practices.',
    body: 'This class explores nervous system regulation and emotional tension patterns held in the body.',
  }),
  course({
    id: 3,
    title: 'Deep Tissue Pain Relief for Chronic Back Pain',
    excerpt: 'Targeted relief for chronic back and joint pain through slow, therapeutic movement.',
    body: 'A purely physical technique for pain management, no emotional framing.',
  }),
  course({
    id: 4,
    title: 'Deep Sleep Reset: Fall Asleep Faster',
    excerpt: 'A calming nidra practice to quiet the mind, ease insomnia, and help you fall asleep faster.',
  }),
  course({
    id: 5,
    title: 'Restorative Yoga Flow',
    excerpt: 'Gentle yoga postures to restore energy and flexibility.',
  }),
  course({
    id: 6,
    title: 'Cortisol & Calm: A Stress Reset Practice',
    excerpt: 'Lower cortisol and manage stress with breathing and gentle movement.',
  }),
  course({
    id: 7,
    title: 'Morning Energy Flow',
    excerpt: 'A short daily movement sequence to boost energy and vitality.',
    body: 'Chronic stress can elevate cortisol, which affects long-term energy levels.',
  }),
  course({
    id: 8,
    title: "Men's Vitality & Testosterone Reset",
    excerpt: "Boost testosterone and energy for men's health.",
  }),
  course({
    id: 9,
    title: 'Gut Health & Digestion Reset',
    excerpt: 'Improve digestion, reduce bloating, and support your microbiome with daily gut-friendly habits.',
  }),
  course({
    id: 12,
    title: 'Focus & Productivity Bootcamp',
    excerpt: 'Sharpen your attention and get more done every day.',
    body: 'Some students mention that gut instinct decisions improve once their mind is calm.',
  }),
];

const ids = (courses: Course[]) => courses.map((c) => c.id);

test('STOP_WORDS: "focused" is filtered — does not change results', () => {
  const base = rankCourses(CATALOG, 'shoulder exercises', {}, 5);
  const withFiller = rankCourses(CATALOG, 'focused shoulder exercises', {}, 5);
  assert.ok(base.length > 0, 'Baseline query returned no results');
  assert.deepEqual(ids(withFiller), ids(base));
});

test('STOP_WORDS: all-stop-words query returns empty array', () => {
  assert.deepEqual(rankCourses(CATALOG, 'is there more about this with some'), []);
});

test('STOP_WORDS: empty string returns empty array', () => {
  assert.deepEqual(rankCourses(CATALOG, ''), []);
});

test('BUG FIX: "shoulder rehab" with filler prefix finds the mobility course', () => {
  const results = rankCourses(CATALOG, 'Is there anything more focused on shoulder rehab?', {}, 5);
  assert.ok(results.length > 0, 'Expected at least one result');
  assert.ok(results.some((c) => c.id === 1), `Expected mobility course id=1. Got: ${ids(results)}`);
});

test('SYNONYM: "tension" ranks the somatic/stress course above the pure pain-relief course', () => {
  const results = rankCourses(CATALOG, 'muscle tension release', {}, 5);
  assert.ok(results.length > 0);
  assert.equal(results[0]?.id, 2, `Top result should be the somatic/stress course. Got: ${ids(results)}`);
});

test('SYNONYM: "sleep" finds the sleep-specific course as the top result', () => {
  const results = rankCourses(CATALOG, 'sleep insomnia nidra', {}, 5);
  assert.ok(results.length > 0);
  assert.equal(results[0]?.id, 4, `Top result should be the sleep course. Got: ${ids(results)}`);
});

test('SCORING: title match outranks body-only match', () => {
  const results = rankCourses(CATALOG, 'cortisol stress', {}, 5);
  assert.ok(results.length > 0);
  assert.equal(results[0]?.id, 6, `Top result should have the keyword in its title. Got: ${ids(results)}`);
});

// The next three tests share the "energy" query, which (against this fixture
// catalog) qualifies exactly three courses in a known order — course 7
// (title match) > course 8 (excerpt match) > course 5 (excerpt match, older
// id) — so each filter's effect on that order can be asserted precisely.
test('FILTER: recency penalty pushes the top course out of #1', () => {
  const baseline = rankCourses(CATALOG, 'energy', {}, 5);
  assert.deepEqual(ids(baseline), [7, 8, 5]);

  const withPenalty = rankCourses(CATALOG, 'energy', { recentlyRecommendedIds: new Set(['7']) }, 5);
  assert.notEqual(withPenalty[0]?.id, 7, `Penalised course should not remain #1. Still got: ${withPenalty[0]?.title}`);
});

test('FILTER: excludeCourseIds removes a course from results entirely', () => {
  const results = rankCourses(CATALOG, 'energy', { excludeCourseIds: new Set(['7']) }, 5);
  assert.deepEqual(ids(results), [8, 5]);
});

test('FILTER: audience guard — men\'s course excluded for a female profile', () => {
  const query = 'testosterone energy men health';
  const open = rankCourses(CATALOG, query, {}, 10);
  const female = rankCourses(CATALOG, query, { userProfile: { gender: 'female' } }, 10);

  assert.ok(open.some((c) => c.id === 8), 'Expected the men\'s course to appear with no profile set');
  assert.ok(!female.some((c) => c.id === 8), `Men's course slipped into female results: ${ids(female)}`);
});

test('FILTER: limit parameter is respected', () => {
  const results = rankCourses(CATALOG, 'energy', {}, 2);
  assert.deepEqual(ids(results), [7, 8]);
});

test('NOISE GUARD: "gut health" — top result is topically aligned, incidental mention excluded', () => {
  const results = rankCourses(CATALOG, 'gut health', {}, 5);
  assert.ok(results.length > 0);
  assert.equal(results[0]?.id, 9, `Top result should be the gut health course. Got: ${ids(results)}`);
  assert.ok(!results.some((c) => c.id === 12), `Incidental "gut instinct" mention should be excluded by the noise guard: ${ids(results)}`);
});
