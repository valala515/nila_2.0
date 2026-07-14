import type { TurnRecord } from '../../domain/turnRecord.js';

export interface TurnRepository {
  save(turn: TurnRecord): Promise<void>;
}
