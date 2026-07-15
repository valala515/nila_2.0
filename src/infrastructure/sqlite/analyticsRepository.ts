import type Database from 'better-sqlite3';
import type {
  AnalyticsQueryPort,
  TurnReachCount,
  FieldReachCount,
  FeltHeardStats,
  CostPerSessionStats,
} from '../../application/ports/analyticsQueryPort.js';

const COST_EVENT_NAMES = ['llm_call_completed', 'stt_call_completed'] as const;

export function createAnalyticsRepository(db: Database.Database): AnalyticsQueryPort {
  const countByName = db.prepare('SELECT COUNT(*) AS count FROM events WHERE name = ? AND created_at_iso >= ?');

  const turnReachStmt = db.prepare(`
    SELECT
      CAST(json_extract(properties_json, '$.turnNumber') AS INTEGER) AS turn_number,
      COUNT(DISTINCT user_id) AS reached_count
    FROM events
    WHERE name = 'interview_turn_answered' AND created_at_iso >= ?
    GROUP BY turn_number
    ORDER BY turn_number ASC
  `);

  const fieldReachStmt = db.prepare(`
    SELECT field_key_row.value AS field_key, COUNT(DISTINCT events.user_id) AS reached_count
    FROM events, json_each(events.properties_json, '$.fieldsTransitionedToKnown') AS field_key_row
    WHERE events.name = 'interview_turn_answered' AND events.created_at_iso >= ?
    GROUP BY field_key_row.value
  `);

  const feltHeardScoresStmt = db.prepare(`
    SELECT CAST(json_extract(properties_json, '$.score') AS INTEGER) AS score
    FROM events
    WHERE name = 'feedback_submitted'
      AND json_extract(properties_json, '$.kind') = 'felt_heard'
      AND created_at_iso >= ?
  `);

  const costTotalStmt = db.prepare(`
    SELECT COALESCE(SUM(json_extract(properties_json, '$.estimatedCostUsd')), 0) AS total_cost
    FROM events
    WHERE name IN (${COST_EVENT_NAMES.map(() => '?').join(', ')}) AND created_at_iso >= ?
  `);

  return {
    async countInterviewsStarted(sinceIso: string): Promise<number> {
      const row = countByName.get('interview_started', sinceIso) as { count: number };
      return row.count;
    },

    async countInterviewsCompleted(sinceIso: string): Promise<number> {
      const row = countByName.get('interview_completed', sinceIso) as { count: number };
      return row.count;
    },

    async getTurnReachCounts(sinceIso: string): Promise<TurnReachCount[]> {
      const rows = turnReachStmt.all(sinceIso) as Array<{ turn_number: number; reached_count: number }>;
      return rows.map((row) => ({ turnNumber: row.turn_number, reachedCount: row.reached_count }));
    },

    async getFieldReachCounts(sinceIso: string): Promise<FieldReachCount[]> {
      const rows = fieldReachStmt.all(sinceIso) as Array<{ field_key: string; reached_count: number }>;
      return rows.map((row) => ({ fieldKey: row.field_key, reachedCount: row.reached_count }));
    },

    async getFeltHeardStats(sinceIso: string): Promise<FeltHeardStats> {
      const rows = feltHeardScoresStmt.all(sinceIso) as Array<{ score: number }>;
      const distribution: Record<number, number> = {};
      for (const { score } of rows) distribution[score] = (distribution[score] ?? 0) + 1;
      const averageScore = rows.length > 0 ? rows.reduce((sum, row) => sum + row.score, 0) / rows.length : null;
      return { averageScore, responseCount: rows.length, distribution };
    },

    async getCostPerCompletedSession(sinceIso: string): Promise<CostPerSessionStats> {
      const completedRow = countByName.get('interview_completed', sinceIso) as { count: number };
      const costRow = costTotalStmt.get(...COST_EVENT_NAMES, sinceIso) as { total_cost: number };
      const completedSessionCount = completedRow.count;
      const totalCostUsd = costRow.total_cost;
      return {
        completedSessionCount,
        totalCostUsd,
        costPerCompletedSessionUsd: completedSessionCount > 0 ? totalCostUsd / completedSessionCount : null,
      };
    },
  };
}
