// Зеркалит DashboardMetrics из src/application/useCases/getDashboardMetrics.ts —
// это публичный контракт /api/dashboard-metrics, а не внутренний тип бэкенда,
// поэтому дублирование здесь осознанное (SPA не импортирует TS бэкенда через процесс).
export interface FunnelStep {
  key: string;
  label: string;
  reachedCount: number;
  dropOffCount: number;
  dropOffRate: number;
}

export interface DashboardMetrics {
  interviewCompletion: { startedCount: number; completedCount: number; completionRate: number | null };
  funnelByTurn: FunnelStep[];
  funnelByField: FunnelStep[];
  feltHeard: { averageScore: number | null; responseCount: number; distribution: Record<number, number> };
  costPerCompletedSession: {
    completedSessionCount: number;
    totalCostUsd: number;
    costPerCompletedSessionUsd: number | null;
  };
}

export type InterviewPhase = 'intro' | 'impact' | 'history' | 'support' | 'readiness' | 'synthesis';

// Зеркалит ConversationSummary/ConversationsFilter/ConversationsPage/TranscriptEntry
// из src/application/ports/conversationsQueryPort.ts — тот же осознанный дубликат, что FunnelStep выше.
export interface ConversationSummary {
  sessionId: number;
  userId: string;
  startedAtIso: string;
  endedAtIso: string | null;
  lastActivityAtIso: string;
  reachedPhase: InterviewPhase;
  completed: boolean;
  turnCount: number;
  avgAnswerChars: number;
}

export interface ConversationsFilter {
  userId?: string;
  reachedPhase?: InterviewPhase;
  completed?: boolean;
}

export interface ConversationsPage {
  conversations: ConversationSummary[];
  nextCursor: number | null;
}

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  createdAtIso: string;
}
