import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { createDatabase } from '../../src/infrastructure/sqlite/db.js';
import { createSessionRepository } from '../../src/infrastructure/sqlite/sessionRepository.js';
import { createTurnRepository } from '../../src/infrastructure/sqlite/turnRepository.js';
import { createConversationsRepository } from '../../src/infrastructure/sqlite/conversationsRepository.js';

// Изолированная временная копия SQLite на каждый тест (CLAUDE.md §8).
async function withTempDb(run: (db: Database.Database) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'nila-conversations-test-'));
  const db = createDatabase(join(dir, 'test.sqlite'));
  try {
    await run(db);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('listConversations returns sessions for a user ordered most-recent-first', async () => {
  await withTempDb(async (db) => {
    const session = createSessionRepository(db);
    const repo = createConversationsRepository(db);
    const userId = 'user-1';

    const firstId = await session.openNewSession(userId);
    const secondId = await session.openNewSession(userId);

    const page = await repo.listConversations({ userId }, null, 10);

    assert.deepEqual(page.conversations.map((c) => c.sessionId), [secondId, firstId]);
    assert.equal(page.nextCursor, null);
  });
});

test('listConversations filters by reachedPhase and completed', async () => {
  await withTempDb(async (db) => {
    const session = createSessionRepository(db);
    const repo = createConversationsRepository(db);
    const userId = 'user-2';

    const droppedSessionId = await session.openNewSession(userId);
    await session.recordUserTurn(droppedSessionId, { answerChars: 10, phaseAfter: 'impact', completed: false });

    const completedSessionId = await session.openNewSession(userId);
    await session.recordUserTurn(completedSessionId, { answerChars: 20, phaseAfter: 'synthesis', completed: true });

    const droppedOnly = await repo.listConversations({ userId, completed: false }, null, 10);
    assert.deepEqual(droppedOnly.conversations.map((c) => c.sessionId), [droppedSessionId]);

    const completedOnly = await repo.listConversations({ userId, completed: true }, null, 10);
    assert.deepEqual(completedOnly.conversations.map((c) => c.sessionId), [completedSessionId]);

    const byPhase = await repo.listConversations({ userId, reachedPhase: 'impact' }, null, 10);
    assert.deepEqual(byPhase.conversations.map((c) => c.sessionId), [droppedSessionId]);
  });
});

test('listConversations paginates with a keyset cursor', async () => {
  await withTempDb(async (db) => {
    const session = createSessionRepository(db);
    const repo = createConversationsRepository(db);
    const userId = 'user-3';

    const ids: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      ids.push(await session.openNewSession(userId));
    }
    const expectedOrder = [...ids].reverse();

    const firstPage = await repo.listConversations({ userId }, null, 2);
    assert.deepEqual(firstPage.conversations.map((c) => c.sessionId), expectedOrder.slice(0, 2));
    assert.notEqual(firstPage.nextCursor, null);

    const secondPage = await repo.listConversations({ userId }, firstPage.nextCursor, 2);
    assert.deepEqual(secondPage.conversations.map((c) => c.sessionId), expectedOrder.slice(2, 4));
    assert.notEqual(secondPage.nextCursor, null);

    const thirdPage = await repo.listConversations({ userId }, secondPage.nextCursor, 2);
    assert.deepEqual(thirdPage.conversations.map((c) => c.sessionId), expectedOrder.slice(4, 5));
    assert.equal(thirdPage.nextCursor, null);
  });
});

test('getTranscript merges user turns and bot messages in chronological order', async () => {
  await withTempDb(async (db) => {
    const session = createSessionRepository(db);
    const turnRepository = createTurnRepository(db);
    const repo = createConversationsRepository(db);
    const userId = 'user-4';

    const sessionId = await session.openNewSession(userId);
    await session.recordBotMessage(sessionId, userId, 'Hi, what brings you here today?');
    await wait(5);
    await turnRepository.save(
      { userId, channel: 'text', text: 'My back hurts', tone: 'neutral', createdAtIso: new Date().toISOString() },
      sessionId,
    );
    await wait(5);
    await session.recordBotMessage(sessionId, userId, 'How long has this been going on?');

    const transcript = await repo.getTranscript(sessionId);

    assert.deepEqual(
      transcript.map((entry) => entry.role),
      ['assistant', 'user', 'assistant'],
    );
    assert.equal(transcript[1].text, 'My back hurts');
  });
});
