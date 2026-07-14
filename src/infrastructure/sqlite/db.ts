import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function createDatabase(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      text TEXT NOT NULL,
      tone TEXT NOT NULL,
      created_at_iso TEXT NOT NULL
    );
  `);
  return db;
}
