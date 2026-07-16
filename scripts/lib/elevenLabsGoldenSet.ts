// Shared helpers for the golden-set scripts (stt:benchmark, stt:review) — both
// synthesize the same fixture via ElevenLabs before feeding it through the
// production STT adapter; kept in one place so the two scripts' TTS logic
// can't silently drift apart.
import { readFileSync } from 'node:fs';
import type { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import type { AnalyticsEventPort } from '../../src/application/ports/analyticsEventPort.js';
import type { CriticalFact } from '../../src/domain/sttCriticalFactRecall.js';

export interface GoldenClip {
  readonly id: string;
  readonly category: string;
  readonly text: string;
  readonly criticalFacts: CriticalFact[];
}

const TTS_MODEL = 'eleven_multilingual_v2';

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is required — add it to .env before running this script.`);
    process.exit(1);
  }
  return value;
}

export function loadGoldenSet(path: string): GoldenClip[] {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export function createSilentAnalyticsEvent(): AnalyticsEventPort {
  return { async record() {} };
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function pickVoiceIds(elevenlabs: ElevenLabsClient, count: number): Promise<string[]> {
  // .getAll is deprecated upstream but simplest for a one-off dev script — see
  // docs/adr/0003-stt-vendor-openai.md for why this only ever runs manually, not in CI.
  const { voices } = await elevenlabs.voices.getAll();
  if (voices.length === 0) throw new Error('ElevenLabs account has no available voices.');
  return Array.from({ length: count }, (_, i) => voices[i % voices.length].voiceId);
}

export async function synthesizeClip(elevenlabs: ElevenLabsClient, voiceId: string, text: string): Promise<Buffer> {
  const stream = await elevenlabs.textToSpeech.convert(voiceId, {
    text,
    modelId: TTS_MODEL,
    outputFormat: 'mp3_44100_128',
  });
  return streamToBuffer(stream);
}
