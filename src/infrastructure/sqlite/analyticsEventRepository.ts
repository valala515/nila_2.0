import type Database from 'better-sqlite3';
import type { AnalyticsEventPort } from '../../application/ports/analyticsEventPort.js';

export function createAnalyticsEventRepository(db: Database.Database): AnalyticsEventPort {
  const insert = db.prepare(
    'INSERT INTO events (name, user_id, properties_json, created_at_iso) VALUES (?, ?, ?, ?)',
  );

  return {
    async record(name, userId, properties) {
      insert.run(name, userId, JSON.stringify(properties), new Date().toISOString());
    },
  };
}
