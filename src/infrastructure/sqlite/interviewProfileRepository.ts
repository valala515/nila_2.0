import type Database from 'better-sqlite3';
import type { InterviewProfileRepository } from '../../application/ports/interviewProfileRepository.js';
import type { InterviewProfile } from '../../domain/interviewProfile.js';

export function createInterviewProfileRepository(db: Database.Database): InterviewProfileRepository {
  const selectByUser = db.prepare('SELECT profile_json FROM profiles WHERE user_id = ?');
  const upsert = db.prepare(`
    INSERT INTO profiles (user_id, profile_json, updated_at_iso) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET profile_json = excluded.profile_json, updated_at_iso = excluded.updated_at_iso
  `);

  return {
    async load(userId: string): Promise<InterviewProfile | null> {
      const row = selectByUser.get(userId) as { profile_json: string } | undefined;
      return row ? (JSON.parse(row.profile_json) as InterviewProfile) : null;
    },
    async save(profile: InterviewProfile): Promise<void> {
      upsert.run(profile.userId, JSON.stringify(profile), new Date().toISOString());
    },
  };
}
