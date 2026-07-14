import type { InterviewProfile } from '../../domain/interviewProfile.js';

export interface InterviewProfileRepository {
  load(userId: string): Promise<InterviewProfile | null>;
  save(profile: InterviewProfile): Promise<void>;
}
