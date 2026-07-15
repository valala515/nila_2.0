import type { InterviewPhase } from '../../domain/interviewProfile.js';

export interface ConversationSummary {
  readonly sessionId: number;
  readonly userId: string;
  readonly startedAtIso: string;
  readonly endedAtIso: string | null;
  readonly lastActivityAtIso: string;
  readonly reachedPhase: InterviewPhase;
  readonly completed: boolean;
  readonly turnCount: number;
  readonly avgAnswerChars: number;
}

export interface ConversationsFilter {
  readonly userId?: string;
  readonly reachedPhase?: InterviewPhase;
  readonly completed?: boolean;
}

export interface ConversationsPage {
  readonly conversations: ConversationSummary[];
  /** Session id курсора для следующей страницы (keyset), null — страниц больше нет. */
  readonly nextCursor: number | null;
}

export interface TranscriptEntry {
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly createdAtIso: string;
}

export interface ConversationsQueryPort {
  listConversations(filter: ConversationsFilter, cursor: number | null, limit: number): Promise<ConversationsPage>;
  /** Ходы пользователя + реплики бота этой сессии, слитые по created_at_iso. */
  getTranscript(sessionId: number): Promise<TranscriptEntry[]>;
}
