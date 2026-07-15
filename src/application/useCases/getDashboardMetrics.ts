import { PROFILE_FIELD_CATALOG } from '../../domain/interviewProfile.js';
import type { AnalyticsQueryPort } from '../ports/analyticsQueryPort.js';

export interface FunnelStep {
  readonly key: string;
  readonly label: string;
  readonly reachedCount: number;
  readonly dropOffCount: number;
  readonly dropOffRate: number;
}

export interface DashboardMetrics {
  readonly interviewCompletion: { startedCount: number; completedCount: number; completionRate: number | null };
  readonly funnelByTurn: FunnelStep[];
  readonly funnelByField: FunnelStep[];
  readonly feltHeard: { averageScore: number | null; responseCount: number; distribution: Record<number, number> };
  readonly costPerCompletedSession: {
    completedSessionCount: number;
    totalCostUsd: number;
    costPerCompletedSessionUsd: number | null;
  };
}

/**
 * SPEC: buildFunnelSteps
 * Назначение: превратить ряд "reachedCount на шаг" в funnel с drop-off относительно
 *   предыдущего шага (первый шаг — относительно стартовавших интервью).
 * Входы/Выход: стартовавшие + упорядоченный список {key,label,reachedCount} → FunnelStep[]
 * Разрешённые side effects: нет (чистая функция)
 */
function buildFunnelSteps(
  startedCount: number,
  steps: ReadonlyArray<{ key: string; label: string; reachedCount: number }>,
): FunnelStep[] {
  let previousReached = startedCount;
  return steps.map((step) => {
    const dropOffCount = Math.max(previousReached - step.reachedCount, 0);
    const dropOffRate = previousReached > 0 ? dropOffCount / previousReached : 0;
    previousReached = step.reachedCount;
    return { ...step, dropOffCount, dropOffRate };
  });
}

/**
 * SPEC: getDashboardMetrics
 * Назначение: собрать все Tier 1 метрики дашборда за период одним вызовом.
 * Входы/Выход: sinceIso (нижняя граница created_at_iso) + AnalyticsQueryPort → DashboardMetrics
 * Разрешённые side effects: нет (только чтение через порт)
 */
export async function getDashboardMetrics(sinceIso: string, analyticsQuery: AnalyticsQueryPort): Promise<DashboardMetrics> {
  const [startedCount, completedCount, turnReach, fieldReach, feltHeard, cost] = await Promise.all([
    analyticsQuery.countInterviewsStarted(sinceIso),
    analyticsQuery.countInterviewsCompleted(sinceIso),
    analyticsQuery.getTurnReachCounts(sinceIso),
    analyticsQuery.getFieldReachCounts(sinceIso),
    analyticsQuery.getFeltHeardStats(sinceIso),
    analyticsQuery.getCostPerCompletedSession(sinceIso),
  ]);

  const funnelByTurn = buildFunnelSteps(
    startedCount,
    turnReach.map((row) => ({ key: String(row.turnNumber), label: `Turn ${row.turnNumber}`, reachedCount: row.reachedCount })),
  );

  const reachedByField = new Map(fieldReach.map((row) => [row.fieldKey, row.reachedCount]));
  const funnelByField = buildFunnelSteps(
    startedCount,
    PROFILE_FIELD_CATALOG.map((field) => ({
      key: field.key,
      label: field.description,
      reachedCount: reachedByField.get(field.key) ?? 0,
    })),
  );

  return {
    interviewCompletion: {
      startedCount,
      completedCount,
      completionRate: startedCount > 0 ? completedCount / startedCount : null,
    },
    funnelByTurn,
    funnelByField,
    feltHeard,
    costPerCompletedSession: cost,
  };
}
