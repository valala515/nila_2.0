import OpenAI, { toFile } from 'openai';
import type { SpeechToTextPort } from '../../application/ports/speechToTextPort.js';
import type { AnalyticsEventPort } from '../../application/ports/analyticsEventPort.js';
import { estimateSttCostUsd } from '../../domain/costEstimate.js';
import { buildSttPrompt } from '../../domain/sttGlossary.js';

const MODEL = 'gpt-4o-transcribe';

// OpenAI's transcription endpoint sniffs the container format from the file
// *extension*, not just the declared content-type — a mismatched extension
// (e.g. mp3 bytes named ".ogg") fails with "Audio file might be corrupted or
// unsupported". Telegram voice notes are always audio/ogg in production, so a
// hardcoded ".ogg" name never surfaced this; the STT golden benchmark (which
// feeds mp3 clips through this same adapter) did.
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/webm': 'webm',
};

function fileNameForMimeType(mimeType: string): string {
  return `voice-message.${EXTENSION_BY_MIME_TYPE[mimeType] ?? 'bin'}`;
}

export function createSpeechToText(client: OpenAI, analyticsEvent: AnalyticsEventPort): SpeechToTextPort {
  return {
    async transcribe(audio: Buffer, mimeType: string, context): Promise<string> {
      const file = await toFile(audio, fileNameForMimeType(mimeType), { type: mimeType });
      const startedAt = Date.now();
      const transcription = await client.audio.transcriptions.create({
        file,
        model: MODEL,
        language: 'en',
        prompt: buildSttPrompt(),
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
