// Manual retrospective STT benchmark (docs/sprint-plan.md, Wed 15 Jul —
// "Voice benchmark"; docs/adr/0003-stt-vendor-openai.md). Not part of `pnpm
// test`/CI on purpose: it makes real, billed calls to ElevenLabs (TTS) and
// OpenAI (STT) — see ADR for why that must not run on every push to main.
// Run with: pnpm run stt:benchmark
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
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

interface ClipReport {
  readonly id: string;
  readonly category: string;
  readonly recall: number;
  readonly missingFacts: string[];
}

const VOICE_COUNT_FOR_DIVERSITY = 4;
const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_SET_PATH = join(__dirname, '../tests/contract/fixtures/sttGoldenSet.json');

function printReport(reports: ClipReport[]): void {
  const worstFirst = [...reports].sort((a, b) => a.recall - b.recall);
  for (const report of worstFirst) {
    const pct = Math.round(report.recall * 100);
    console.log(`[${report.category}] ${report.id}: ${pct}%${report.recall < 1 ? ' <-- missing facts' : ''}`);
    if (report.missingFacts.length > 0) console.log(`    missing: ${report.missingFacts.join(', ')}`);
  }

  const overallRecall = reports.reduce((sum, r) => sum + r.recall, 0) / reports.length;
  console.log(`\nOverall Critical Fact Recall: ${(overallRecall * 100).toFixed(1)}% across ${reports.length} clips`);

  const recallsByCategory = new Map<string, number[]>();
  for (const report of reports) {
    recallsByCategory.set(report.category, [...(recallsByCategory.get(report.category) ?? []), report.recall]);
  }
  for (const [category, recalls] of recallsByCategory) {
    const avg = recalls.reduce((a, b) => a + b, 0) / recalls.length;
    console.log(`  ${category}: ${(avg * 100).toFixed(1)}%`);
  }
}

async function benchmarkClip(
  elevenlabs: ElevenLabsClient,
  speechToText: ReturnType<typeof createSpeechToText>,
  voiceId: string,
  clip: GoldenClip,
): Promise<ClipReport> {
  const audio = await synthesizeClip(elevenlabs, voiceId, clip.text);
  const transcript = await speechToText.transcribe(audio, 'audio/mpeg', {
    userId: 'stt-benchmark',
    audioDurationSec: 0,
  });
  const { recall, missingFacts } = computeCriticalFactRecall(transcript, clip.criticalFacts);
  return { id: clip.id, category: clip.category, recall, missingFacts };
}

async function main(): Promise<void> {
  const elevenlabs = new ElevenLabsClient({ apiKey: requireEnv('ELEVENLABS_API_KEY') });
  const speechToText = createSpeechToText(createOpenAiClient(requireEnv('OPENAI_API_KEY')), createSilentAnalyticsEvent());

  const goldenSet = loadGoldenSet(GOLDEN_SET_PATH);
  const voiceIds = await pickVoiceIds(elevenlabs, VOICE_COUNT_FOR_DIVERSITY);
  console.log(`Running STT golden benchmark: ${goldenSet.length} clips, ${voiceIds.length} voices.\n`);

  const reports: ClipReport[] = [];
  for (const [index, clip] of goldenSet.entries()) {
    reports.push(await benchmarkClip(elevenlabs, speechToText, voiceIds[index % voiceIds.length], clip));
  }

  printReport(reports);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
