export interface TurnReachCount {
  readonly turnNumber: number;
  readonly reachedCount: number;
}

export interface FieldReachCount {
  readonly fieldKey: string;
  readonly reachedCount: number;
}

export interface FeltHeardStats {
  readonly averageScore: number | null;
  readonly responseCount: number;
  readonly distribution: Record<number, number>;
}

export interface CostPerSessionStats {
  readonly completedSessionCount: number;
  readonly totalCostUsd: number;
  readonly costPerCompletedSessionUsd: number | null;
}

export interface AnalyticsQueryPort {
  countInterviewsStarted(sinceIso: string): Promise<number>;
  countInterviewsCompleted(sinceIso: string): Promise<number>;
  /** Один ряд на каждый turnNumber, встретившийся хотя бы у одного пользователя. */
  getTurnReachCounts(sinceIso: string): Promise<TurnReachCount[]>;
  /** Один ряд на каждый profile field, ставший known хотя бы у одного пользователя. */
  getFieldReachCounts(sinceIso: string): Promise<FieldReachCount[]>;
  getFeltHeardStats(sinceIso: string): Promise<FeltHeardStats>;
  getCostPerCompletedSession(sinceIso: string): Promise<CostPerSessionStats>;
}
