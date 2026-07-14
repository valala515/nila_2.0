import type { ProfileField, OpenThread, InterviewProfile } from '../../domain/interviewProfile.js';
import type { TurnRecord } from '../../domain/turnRecord.js';
import type { ToneLabel } from '../../domain/toneLabel.js';

export interface InterviewTurnResult {
  readonly fieldUpdates: ProfileField[];
  readonly openThreads: OpenThread[];
  readonly nextQuestion: string;
  readonly flaggedForReview: boolean;
}

export interface InterviewEnginePort {
  advance(input: {
    userAnswer: string;
    profile: InterviewProfile;
    recentTurns: TurnRecord[];
    tone: ToneLabel;
  }): Promise<InterviewTurnResult>;
}
