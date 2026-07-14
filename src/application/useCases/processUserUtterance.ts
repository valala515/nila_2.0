import type { ToneAnalysisPort } from '../ports/toneAnalysisPort.js';
import type { TurnRepository } from '../ports/turnRepository.js';
import type { TurnRecord, TurnChannel } from '../../domain/turnRecord.js';

export interface ProcessUserUtteranceDeps {
  toneAnalysis: ToneAnalysisPort;
  turnRepository: TurnRepository;
}

/**
 * SPEC: processUserUtterance
 * Назначение: оценить тон реплики пользователя и сохранить её как часть профиля
 * Входы/Выход: userId, текст (уже транскрибированный, если голос), канал → сохранённый TurnRecord
 * Разрешённые side effects: запись в TurnRepository
 * Запрещено: логировать text через console/observability — только через TurnRepository
 */
export async function processUserUtterance(
  userId: string,
  text: string,
  channel: TurnChannel,
  deps: ProcessUserUtteranceDeps,
): Promise<TurnRecord> {
  const tone = await deps.toneAnalysis.analyzeTone(text);
  const turn: TurnRecord = {
    userId,
    channel,
    text,
    tone,
    createdAtIso: new Date().toISOString(),
  };
  const id = await deps.turnRepository.save(turn);
  return { ...turn, id };
}
