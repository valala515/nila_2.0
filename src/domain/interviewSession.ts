export type InterviewSessionStatus = 'not_started' | 'in_progress' | 'awaiting_confirmation';

export interface InterviewSession {
  readonly userId: string;
  readonly status: InterviewSessionStatus;
}

export function startInterviewSession(userId: string): InterviewSession {
  return { userId, status: 'not_started' };
}
