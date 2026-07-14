import OpenAI from 'openai';
import { z } from 'zod';
import { TONE_LABELS, type ToneLabel } from '../../domain/toneLabel.js';
import type { ToneAnalysisPort } from '../../application/ports/toneAnalysisPort.js';

const toneResponseSchema = z.object({ tone: z.enum(TONE_LABELS) });
const DEFAULT_TONE: ToneLabel = 'neutral';

export function createToneAnalyzer(client: OpenAI): ToneAnalysisPort {
  return {
    async analyzeTone(text: string): Promise<ToneLabel> {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Classify the emotional tone of the user's message. Reply with strict JSON only: {"tone": one of [${TONE_LABELS.join(', ')}]}.`,
          },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
      });
      const raw = completion.choices[0]?.message.content ?? '{}';
      const parsed = toneResponseSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data.tone : DEFAULT_TONE;
    },
  };
}
