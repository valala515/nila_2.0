import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { createDatabase } from '../../src/infrastructure/sqlite/db.js';
import { createCourseRepository } from '../../src/infrastructure/sqlite/courseRepository.js';
import type { Course } from '../../src/domain/course.js';

// Isolated temp SQLite file per test (CLAUDE.md §8) — not a shared on-disk
// file, so parallel test runs can't flake on shared state.
async function withTempDb(run: (db: Database.Database) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'nila-courses-test-'));
  const db = createDatabase(join(dir, 'test.sqlite'));
  try {
    await run(db);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function sampleCourse(overrides: Partial<Course> & Pick<Course, 'id' | 'title'>): Course {
  return {
    slug: `course-${overrides.id}`,
    author: 'Jane Doe',
    rating: 4.5,
    ratingCount: 10,
    thumbUrl: null,
    excerpt: 'An excerpt.',
    body: 'A body.',
    lessonTitles: ['Lesson 1'],
    lessonsCount: 1,
    courseFocus: 'Focus',
    lang: 'en',
    topics: ['sleep_rest'],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('saveAll replaces the full catalog and findAll returns it back', async () => {
  await withTempDb(async (db) => {
    const repo = createCourseRepository(db);
    await repo.saveAll([sampleCourse({ id: 1, title: 'First' }), sampleCourse({ id: 2, title: 'Second' })]);

    const all = await repo.findAll();
    assert.equal(all.length, 2);
    assert.deepEqual(
      all.map((c) => c.title).sort(),
      ['First', 'Second'],
    );
  });
});

test('saveAll called again fully replaces the previous catalog (no stale rows)', async () => {
  await withTempDb(async (db) => {
    const repo = createCourseRepository(db);
    await repo.saveAll([sampleCourse({ id: 1, title: 'Old Course' })]);
    await repo.saveAll([sampleCourse({ id: 2, title: 'New Course' })]);

    const all = await repo.findAll();
    assert.deepEqual(
      all.map((c) => c.id),
      [2],
    );
  });
});

test('findById returns the matching course with all fields round-tripped', async () => {
  await withTempDb(async (db) => {
    const repo = createCourseRepository(db);
    const original = sampleCourse({ id: 42, title: 'Deep Sleep Reset' });
    await repo.saveAll([original]);

    const found = await repo.findById(42);
    assert.deepEqual(found, original);
  });
});

test('findById returns null for an unknown id', async () => {
  await withTempDb(async (db) => {
    const repo = createCourseRepository(db);
    await repo.saveAll([sampleCourse({ id: 1, title: 'Only Course' })]);

    assert.equal(await repo.findById(999), null);
  });
});
