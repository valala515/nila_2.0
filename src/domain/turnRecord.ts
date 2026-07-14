import type { ToneLabel } from './toneLabel.js';

export type TurnChannel = 'text' | 'voice';

export interface TurnRecord {
  readonly userId: string;
  readonly channel: TurnChannel;
  readonly text: string;
  readonly tone: ToneLabel;
  readonly createdAtIso: string;
}
