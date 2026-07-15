import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { createDatabase } from '../../src/infrastructure/sqlite/db.js';
import { createAnalyticsRepository } from '../../src/infrastructure/sqlite/analyticsRepository.js';

// Изолированная временная копия SQLite на каждый тест (CLAUDE.md §8) — не общий
// on-disk файл, чтобы параллельный запуск тестов не был источником flakiness.
async function withTempDb(run: (db: Database.Database) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'nila-analytics-test-'));
  const db = createDatabase(join(dir, 'test.sqlite'));
  try {
    await run(db);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function seedEvent(db: Database.Database, name: string, userId: string, properties: Record<string, unknown>): void {
  db.prepare('INSERT INTO events (name, user_id, properties_json, created_at_iso) VALUES (?, ?, ?, ?)').run(
    name,
    userId,
    JSON.stringify(properties),
    new Date().toISOString(),
  );
}

const SINCE = () => new Date(Date.now() - 60_000).toISOString();

test('countInterviewsStarted/Completed count events by name within the window', async () => {
  await withTempDb(async (db) => {
    seedEvent(db, 'interview_started', 'user-1', {});
    seedEvent(db, 'interview_started', 'user-2', {});
    seedEvent(db, 'interview_completed', 'user-1', { totalTurns: 5 });

    const repo = createAnalyticsRepository(db);
    const [started, completed] = await Promise.all([
      repo.countInterviewsStarted(SINCE()),
      repo.countInterviewsCompleted(SINCE()),
    ]);

    assert.equal(started, 2);
    assert.equal(completed, 1);
  });
});

test('getTurnReachCounts counts distinct users reaching each turn number', async () => {
  await withTempDb(async (db) => {
    seedEvent(db, 'interview_turn_answered', 'user-1', { turnNumber: 1, fieldsTransitionedToKnown: [] });
    seedEvent(db, 'interview_turn_answered', 'user-2', { turnNumber: 1, fieldsTransitionedToKnown: [] });
    seedEvent(db, 'interview_turn_answered', 'user-1', { turnNumber: 2, fieldsTransitionedToKnown: [] });

    const repo = createAnalyticsRepository(db);
    const rows = await repo.getTurnReachCounts(SINCE());

    assert.deepEqual(rows, [
      { turnNumber: 1, reachedCount: 2 },
      { turnNumber: 2, reachedCount: 1 },
    ]);
  });
});

test('getFieldReachCounts counts distinct users per field that became known', async () => {
  await withTempDb(async (db) => {
    seedEvent(db, 'interview_turn_answered', 'user-1', { turnNumber: 1, fieldsTransitionedToKnown: ['mainConcern'] });
    seedEvent(db, 'interview_turn_answered', 'user-2', {
      turnNumber: 1,
      fieldsTransitionedToKnown: ['mainConcern', 'goal'],
    });

    const repo = createAnalyticsRepository(db);
    const rows = await repo.getFieldReachCounts(SINCE());
    const byKey = Object.fromEntries(rows.map((row) => [row.fieldKey, row.reachedCount]));

    assert.equal(byKey.mainConcern, 2);
    assert.equal(byKey.goal, 1);
  });
});

test('getFeltHeardStats averages scores and builds a distribution', async () => {
  await withTempDb(async (db) => {
    seedEvent(db, 'feedback_submitted', 'user-1', { kind: 'felt_heard', score: 5 });
    seedEvent(db, 'feedback_submitted', 'user-2', { kind: 'felt_heard', score: 3 });

    const repo = createAnalyticsRepository(db);
    const stats = await repo.getFeltHeardStats(SINCE());

    assert.equal(stats.responseCount, 2);
    assert.equal(stats.averageScore, 4);
    assert.deepEqual(stats.distribution, { 3: 1, 5: 1 });
  });
});

test('getCostPerCompletedSession divides total cost-event spend by completed sessions', async () => {
  await withTempDb(async (db) => {
    seedEvent(db, 'interview_completed', 'user-1', { totalTurns: 5 });
    seedEvent(db, 'llm_call_completed', 'user-1', { estimatedCostUsd: 0.02 });
    seedEvent(db, 'stt_call_completed', 'user-1', { estimatedCostUsd: 0.01 });

    const repo = createAnalyticsRepository(db);
    const stats = await repo.getCostPerCompletedSession(SINCE());

    assert.equal(stats.completedSessionCount, 1);
    assert.ok(Math.abs(stats.totalCostUsd - 0.03) < 1e-9);
    assert.ok(Math.abs((stats.costPerCompletedSessionUsd ?? 0) - 0.03) < 1e-9);
  });
});

test('getCostPerCompletedSession returns null per-session cost when nothing completed yet', async () => {
  await withTempDb(async (db) => {
    const repo = createAnalyticsRepository(db);
    const stats = await repo.getCostPerCompletedSession(SINCE());

    assert.equal(stats.completedSessionCount, 0);
    assert.equal(stats.costPerCompletedSessionUsd, null);
  });
});
