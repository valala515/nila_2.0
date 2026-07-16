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
      created_at_iso TEXT NOT NULL,
      session_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY,
      profile_json TEXT NOT NULL,
      updated_at_iso TEXT NOT NULL,
      pending_feedback_kind TEXT
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      properties_json TEXT NOT NULL,
      created_at_iso TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS events_name_idx ON events (name);
    CREATE INDEX IF NOT EXISTS events_user_id_idx ON events (user_id);
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      started_at_iso TEXT NOT NULL,
      ended_at_iso TEXT,
      last_activity_at_iso TEXT NOT NULL,
      reached_phase TEXT NOT NULL,
      completed_at_iso TEXT,
      turn_count INTEGER NOT NULL DEFAULT 0,
      total_answer_chars INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
    CREATE INDEX IF NOT EXISTS sessions_reached_phase_idx ON sessions (reached_phase);
    CREATE INDEX IF NOT EXISTS sessions_completed_at_idx ON sessions (completed_at_iso);
    CREATE TABLE IF NOT EXISTS bot_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      session_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at_iso TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS bot_messages_session_id_idx ON bot_messages (session_id);
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      author TEXT,
      rating REAL,
      rating_count INTEGER,
      thumb_url TEXT,
      excerpt TEXT NOT NULL,
      body TEXT,
      lesson_titles_json TEXT NOT NULL,
      lessons_count INTEGER,
      course_focus TEXT,
      lang TEXT,
      topics_json TEXT NOT NULL,
      created_at TEXT,
      synced_at_iso TEXT NOT NULL
    );
  `);
  addColumnIfMissing(db, 'profiles', 'pending_feedback_kind', 'TEXT');
  addColumnIfMissing(db, 'turns', 'session_id', 'INTEGER');
  return db;
}

// SQLite не поддерживает "ADD COLUMN IF NOT EXISTS" — на уже существующей БД
// (до этой миграции) CREATE TABLE IF NOT EXISTS выше не добавит новую колонку.
function addColumnIfMissing(db: Database.Database, table: string, column: string, type: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.some((col) => col.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}
