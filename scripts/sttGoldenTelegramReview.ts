// Pushes the STT golden set (docs/adr/0003-stt-vendor-openai.md) to a Telegram
// chat for human review: one audio message per clip, captioned with the
// expected text, the actual transcript and the recall result — same
// ElevenLabs → production-STT pipeline as scripts/sttGoldenBenchmark.ts.
// Manual/opt-in, not part of `pnpm test`/CI: real, billed TTS+STT calls.
// Run with: pnpm run stt:review -- <chatId>
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Bot, InputFile } from 'grammy';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { createOpenAiClient } from '../src/infrastructure/openai/client.js';
import { createSpeechToText } from '../src/infrastructure/openai/speechToText.js';
import { computeCriticalFactRecall } from '../src/domain/sttCriticalFactRecall.js';
import {
  type GoldenClip,
  requireEnv,
  loadGoldenSet,
  createSilentAnalyticsEvent,
  pickVoiceIds,
  synthesizeClip,
} from './lib/elevenLabsGoldenSet.js';

const VOICE_COUNT_FOR_DIVERSITY = 4;
const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_SET_PATH = join(__dirname, '../tests/contract/fixtures/sttGoldenSet.json');

function requireChatId(): string {
  // `pnpm run stt:review -- <chatId>` forwards the `--` itself as an argv
  // entry on this pnpm version, not just what follows it — drop it so the
  // documented invocation actually works instead of misreading it as the id.
  const chatId = process.argv.slice(2).find((arg) => arg !== '--');
  if (!chatId) {
    console.error('Usage: pnpm run stt:review -- <chatId>');
    process.exit(1);
  }
  return chatId;
}

function formatCaption(clip: GoldenClip, transcript: string, recall: number, missingFacts: string[]): string {
  const pct = Math.round(recall * 100);
  const lines = [
    `[${clip.category}] ${clip.id} — recall ${pct}%${recall < 1 ? ' ⚠️' : ' ✅'}`,
    `Expected: ${clip.text}`,
    `Transcript: ${transcript}`,
  ];
  if (missingFacts.length > 0) lines.push(`Missing: ${missingFacts.join(', ')}`);
  return lines.join('\n');
}

async function reviewClip(
  bot: Bot,
  chatId: string,
  elevenlabs: ElevenLabsClient,
  speechToText: ReturnType<typeof createSpeechToText>,
  voiceId: string,
  clip: GoldenClip,
): Promise<void> {
  const audio = await synthesizeClip(elevenlabs, voiceId, clip.text);
  const transcript = await speechToText.transcribe(audio, 'audio/mpeg', {
    userId: 'stt-benchmark-review',
    audioDurationSec: 0,
  });
  const { recall, missingFacts } = computeCriticalFactRecall(transcript, clip.criticalFacts);

  await bot.api.sendAudio(chatId, new InputFile(audio, `${clip.id}.mp3`), {
    caption: formatCaption(clip, transcript, recall, missingFacts),
  });
}

async function main(): Promise<void> {
  const chatId = requireChatId();
  const bot = new Bot(requireEnv('TELEGRAM_BOT_TOKEN'));
  const elevenlabs = new ElevenLabsClient({ apiKey: requireEnv('ELEVENLABS_API_KEY') });
  const speechToText = createSpeechToText(createOpenAiClient(requireEnv('OPENAI_API_KEY')), createSilentAnalyticsEvent());

  const goldenSet = loadGoldenSet(GOLDEN_SET_PATH);
  const voiceIds = await pickVoiceIds(elevenlabs, VOICE_COUNT_FOR_DIVERSITY);
  console.log(`Sending ${goldenSet.length} golden clips to chat ${chatId}...`);

  for (const [index, clip] of goldenSet.entries()) {
    await reviewClip(bot, chatId, elevenlabs, speechToText, voiceIds[index % voiceIds.length], clip);
    console.log(`  sent ${clip.id}`);
  }

  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
