export type InterviewSessionStatus = 'not_started' | 'in_progress' | 'awaiting_confirmation';

export interface InterviewSession {
  readonly userId: string;
  readonly status: InterviewSessionStatus;
}

export function startInterviewSession(userId: string, hasExistingProfile: boolean): InterviewSession {
  return { userId, status: hasExistingProfile ? 'in_progress' : 'not_started' };
}
