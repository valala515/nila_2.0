import OpenAI from 'openai';
import { z } from 'zod';
import {
  PROFILE_FIELD_CATALOG,
  onlyDemographicFieldsRemaining,
  type ProfileFieldKey,
} from '../../domain/interviewProfile.js';
import type { InterviewEnginePort } from '../../application/ports/interviewEnginePort.js';
import { loadPrompt } from '../prompts/loadPrompt.js';

const FIELD_KEYS = PROFILE_FIELD_CATALOG.map((field) => field.key) as [ProfileFieldKey, ...ProfileFieldKey[]];

const fieldSchema = z.object({
  key: z.enum(FIELD_KEYS),
  status: z.enum(['known', 'missing', 'deferred']),
  value: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  evidenceQuote: z.string().optional(),
  isContradiction: z.boolean().optional(),
});

const openThreadSchema = z.object({
  topic: z.string(),
  sourceTurnId: z.number(),
});

const responseSchema = z.object({
  fieldUpdates: z.array(fieldSchema),
  openThreads: z.array(openThreadSchema),
  nextQuestion: z.string(),
  flaggedForReview: z.boolean(),
});

const FALLBACK_QUESTION = "Could you tell me a bit more? I want to make sure I understood you correctly.";

const SYSTEM_PROMPT = loadPrompt('interviewEngine.v4.md');

export function createInterviewEngine(client: OpenAI): InterviewEnginePort {
  return {
    async advance({ userAnswer, profile, recentTurns, tone }) {
      const context = {
        currentFields: profile.fields,
        currentPhase: profile.currentPhase,
        activeFields: PROFILE_FIELD_CATALOG.filter((field) => field.phase === profile.currentPhase),
        askDemographicsDirectly: onlyDemographicFieldsRemaining(profile, profile.currentPhase),
        openThreads: profile.openThreads,
        recentTurns: recentTurns.map((turn) => ({ id: turn.id, text: turn.text, tone: turn.tone })),
        latestTone: tone,
        latestAnswer: userAnswer,
      };

      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(context) },
        ],
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message.content ?? '{}';
      const parsed = responseSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        return {
          fieldUpdates: [],
          openThreads: profile.openThreads,
          nextQuestion: FALLBACK_QUESTION,
          flaggedForReview: false,
        };
      }

      // exactOptionalPropertyTypes: zod .optional() типизирует поле как
      // `T | undefined` (присутствует всегда), а не «может отсутствовать» —
      // conditional spread восстанавливает «может отсутствовать» для ProfileField.
      return {
        fieldUpdates: parsed.data.fieldUpdates.map((field) => ({
          key: field.key,
          status: field.status,
          ...(field.value !== undefined && { value: field.value }),
          ...(field.confidence !== undefined && { confidence: field.confidence }),
          ...(field.evidenceQuote !== undefined && { evidenceQuote: field.evidenceQuote }),
          ...(field.isContradiction !== undefined && { isContradiction: field.isContradiction }),
        })),
        openThreads: parsed.data.openThreads,
        nextQuestion: parsed.data.nextQuestion,
        flaggedForReview: parsed.data.flaggedForReview,
      };
    },
  };
}
