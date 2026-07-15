import type { InterviewPhase } from '../../domain/interviewProfile.js';

export interface RecordUserTurnParams {
  readonly answerChars: number;
  readonly phaseAfter: InterviewPhase;
  readonly completed: boolean;
}

export interface SessionPort {
  /** Текущая открытая сессия пользователя, либо новая, если ни одной нет ещё. */
  getOrOpenCurrentSession(userId: string): Promise<number>;
  /** Форсированно закрывает предыдущую открытую сессию (если есть) и открывает новую — /start, reset. */
  openNewSession(userId: string): Promise<number>;
  recordUserTurn(sessionId: number, params: RecordUserTurnParams): Promise<void>;
  /** Также двигает last_activity_at_iso сессии. */
  recordBotMessage(sessionId: number, userId: string, text: string): Promise<void>;
}
