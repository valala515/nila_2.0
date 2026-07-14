import type { ToneLabel } from '../../domain/toneLabel.js';

export interface ToneAnalysisPort {
  analyzeTone(text: string): Promise<ToneLabel>;
}
