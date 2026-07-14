import type { TurnRecord } from '../../domain/turnRecord.js';

export interface TurnRepository {
  /** @returns id сохранённого хода (используется как ссылка из OpenThread) */
  save(turn: TurnRecord): Promise<number>;
  // role filter: user only — таблица turns хранит только реплики пользователя,
  // ответы бота в неё не пишутся.
  listRecent(userId: string, limit: number): Promise<TurnRecord[]>;
}
