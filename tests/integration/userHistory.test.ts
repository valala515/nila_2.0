import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { createDatabase } from '../../src/infrastructure/sqlite/db.js';
import { createTurnRepository } from '../../src/infrastructure/sqlite/turnRepository.js';
import { createInterviewProfileRepository } from '../../src/infrastructure/sqlite/interviewProfileRepository.js';
import { createPendingFeedbackRepository } from '../../src/infrastructure/sqlite/pendingFeedbackRepository.js';
import { createAnalyticsEventRepository } from '../../src/infrastructure/sqlite/analyticsEventRepository.js';
import { createUserResetRepository } from '../../src/infrastructure/sqlite/userResetRepository.js';
import { createSessionRepository } from '../../src/infrastructure/sqlite/sessionRepository.js';
import { resetUserSession, deleteUserHistory, type ManageUserHistoryDeps } from '../../src/application/useCases/manageUserHistory.js';
import { createEmptyProfile } from '../../src/domain/interviewProfile.js';

// Изолированная временная копия SQLite на каждый тест (CLAUDE.md §8).
async function withTempDb(run: (db: Database.Database) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'nila-user-history-test-'));
  const db = createDatabase(join(dir, 'test.sqlite'));
  try {
    await run(db);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function buildDeps(db: Database.Database): ManageUserHistoryDeps & { turnRepository: ReturnType<typeof createTurnRepository> } {
  return {
    interviewProfileRepository: createInterviewProfileRepository(db),
    pendingFeedback: createPendingFeedbackRepository(db),
    session: createSessionRepository(db),
    userReset: createUserResetRepository(db),
    analyticsEvent: createAnalyticsEventRepository(db),
    turnRepository: createTurnRepository(db),
  };
}

test('resetUserSession opens a new session, keeping the previous session and its turns in SQL', async () => {
  await withTempDb(async (db) => {
    const deps = buildDeps(db);
    const userId = 'user-1';
    await deps.interviewProfileRepository.save(createEmptyProfile(userId));

    const firstSessionId = await deps.session.getOrOpenCurrentSession(userId);
    await deps.turnRepository.save(
      { userId, channel: 'text', text: 'old turn', tone: 'neutral', createdAtIso: new Date().toISOString() },
      firstSessionId,
    );

    await resetUserSession(userId, deps);

    const secondSessionId = await deps.session.getOrOpenCurrentSession(userId);
    assert.notEqual(secondSessionId, firstSessionId);

    await deps.turnRepository.save(
      { userId, channel: 'text', text: 'new turn', tone: 'neutral', createdAtIso: new Date().toISOString() },
      secondSessionId,
    );

    assert.deepEqual((await deps.turnRepository.listRecent(secondSessionId, 10)).map((turn) => turn.text), ['new turn']);
    assert.deepEqual((await deps.turnRepository.listRecent(firstSessionId, 10)).map((turn) => turn.text), ['old turn']);

    const sessionRows = db
      .prepare('SELECT id, ended_at_iso FROM sessions WHERE user_id = ? ORDER BY id ASC')
      .all(userId) as Array<{ id: number; ended_at_iso: string | null }>;
    assert.equal(sessionRows.length, 2);
    assert.notEqual(sessionRows[0].ended_at_iso, null, 'first session must be closed after reset');
    assert.equal(sessionRows[1].ended_at_iso, null, 'second session must still be open');
  });
});

test('resetUserSession clears pending feedback and restores an empty profile', async () => {
  await withTempDb(async (db) => {
    const deps = buildDeps(db);
    const userId = 'user-2';
    const profile = createEmptyProfile(userId);
    await deps.interviewProfileRepository.save({ ...profile, currentPhase: 'synthesis' });
    await deps.pendingFeedback.setPending(userId, 'felt_heard');

    await resetUserSession(userId, deps);

    const reloadedProfile = await deps.interviewProfileRepository.load(userId);
    const pending = await deps.pendingFeedback.getPending(userId);

    assert.equal(reloadedProfile?.currentPhase, 'intro');
    assert.equal(pending, null);
  });
});

test('deleteUserHistory removes turns, profile, events, sessions, and bot_messages for the user', async () => {
  await withTempDb(async (db) => {
    const deps = buildDeps(db);
    const userId = 'user-3';
    await deps.interviewProfileRepository.save(createEmptyProfile(userId));
    const sessionId = await deps.session.getOrOpenCurrentSession(userId);
    await deps.turnRepository.save(
      { userId, channel: 'text', text: 'hello', tone: 'neutral', createdAtIso: new Date().toISOString() },
      sessionId,
    );
    await deps.session.recordBotMessage(sessionId, userId, 'hi there');
    await deps.analyticsEvent.record('interview_started', userId, {});

    await deleteUserHistory(userId, deps);

    assert.equal(await deps.interviewProfileRepository.load(userId), null);
    assert.deepEqual(await deps.turnRepository.listRecent(sessionId, 10), []);
    const eventRow = db.prepare('SELECT COUNT(*) AS count FROM events WHERE user_id = ?').get(userId) as { count: number };
    assert.equal(eventRow.count, 0);
    const sessionRow = db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?').get(userId) as { count: number };
    assert.equal(sessionRow.count, 0);
    const botMessageRow = db.prepare('SELECT COUNT(*) AS count FROM bot_messages WHERE user_id = ?').get(userId) as { count: number };
    assert.equal(botMessageRow.count, 0);
  });
});

test('deleteUserHistory does not affect other users', async () => {
  await withTempDb(async (db) => {
    const deps = buildDeps(db);
    await deps.interviewProfileRepository.save(createEmptyProfile('user-4'));
    await deps.interviewProfileRepository.save(createEmptyProfile('user-5'));

    await deleteUserHistory('user-4', deps);

    assert.equal(await deps.interviewProfileRepository.load('user-4'), null);
    assert.notEqual(await deps.interviewProfileRepository.load('user-5'), null);
  });
});
