// Contract test: validates the NMS course API response shape against the
// mapper (courseMapper.ts + courseDescriptionParser.ts), without hitting the
// live API — mirrors ai_agent_chat's real /api/courses + /api/courses/{id}
// response shape (see fixture).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mapCourseListItem, type RawCourseDetail, type RawCourseListItem } from '../../src/infrastructure/newmindstart/courseMapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures/nmsCourseListResponse.json'), 'utf-8'));

test('mapCourseListItem maps a real NMS list+detail response pair to the domain Course shape', () => {
  const raw = fixture.listResponse.data[0] as RawCourseListItem;
  const detail = fixture.detailResponse as RawCourseDetail;

  const course = mapCourseListItem(raw, detail);

  assert.equal(course.id, 1716);
  assert.equal(course.title, 'Tai Chi for Beginners: Balance & Calm');
  assert.equal(course.slug, 'tai-chi-for-beginners');
  assert.equal(course.author, 'Jane Doe');
  assert.equal(course.rating, 4.8);
  assert.equal(course.ratingCount, 132);
  assert.equal(course.thumbUrl, 'https://newmindstart.com/thumbs/1716-big.jpg');
  assert.equal(course.excerpt, 'A gentle introduction to Tai Chi for balance, calm, and mobility.');
  assert.deepEqual(course.lessonTitles, ['Lesson 1: Standing Posture', 'Lesson 2: Weight Shifting']);
  assert.equal(course.lessonsCount, 12);
  assert.equal(course.courseFocus, 'Anyone seeking gentle daily movement');
  assert.equal(course.lang, 'en');
  assert.equal(course.createdAt, '2026-03-01T00:00:00.000Z');
  assert.deepEqual(course.topics, [], 'Mapper does not classify topics — that is the sync use case\'s job');
  assert.ok(course.body?.includes('Tai Chi builds balance and calm'));
  assert.ok(course.body?.includes('Improves balance and coordination'));
});

test('mapCourseListItem falls back gracefully when detail/description is missing', () => {
  const raw = fixture.listResponse.data[0] as RawCourseListItem;
  const course = mapCourseListItem(raw, {});

  assert.equal(course.body, null);
  assert.equal(course.lessonsCount, null);
  assert.equal(course.courseFocus, null);
});
