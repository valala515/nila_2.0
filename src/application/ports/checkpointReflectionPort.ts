import type { InterviewProfile } from '../../domain/interviewProfile.js';
import type { TurnRecord } from '../../domain/turnRecord.js';

export interface CheckpointReflectionPort {
  reflect(profile: InterviewProfile, recentTurns: TurnRecord[]): Promise<string>;
}
