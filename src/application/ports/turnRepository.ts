import type { TurnRecord } from '../../domain/turnRecord.js';

export interface TurnRepository {
  /** @returns id сохранённого хода (используется как ссылка из OpenThread) */
  save(turn: TurnRecord, sessionId: number): Promise<number>;
  // role filter: user only — таблица turns хранит только реплики пользователя,
  // ответы бота пишутся в bot_messages (см. SessionPort).
  listRecent(sessionId: number, limit: number): Promise<TurnRecord[]>;
  /** Порядковый номер хода пользователя в этой сессии (1-based) — единица funnel "по ходу". */
  countForSession(sessionId: number): Promise<number>;
}
