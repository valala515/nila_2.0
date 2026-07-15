import OpenAI, { toFile } from 'openai';
import type { SpeechToTextPort } from '../../application/ports/speechToTextPort.js';
import type { AnalyticsEventPort } from '../../application/ports/analyticsEventPort.js';
import { estimateSttCostUsd } from '../../domain/costEstimate.js';

const MODEL = 'gpt-4o-transcribe';

export function createSpeechToText(client: OpenAI, analyticsEvent: AnalyticsEventPort): SpeechToTextPort {
  return {
    async transcribe(audio: Buffer, mimeType: string, context): Promise<string> {
      const file = await toFile(audio, 'voice-message.ogg', { type: mimeType });
      const startedAt = Date.now();
      const transcription = await client.audio.transcriptions.create({
        file,
        model: MODEL,
      });

      await analyticsEvent.record('stt_call_completed', context.userId, {
        latencyMs: Date.now() - startedAt,
        audioDurationSec: context.audioDurationSec,
        estimatedCostUsd: estimateSttCostUsd(MODEL, context.audioDurationSec),
      });

      return transcription.text;
    },
  };
}
