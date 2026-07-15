import OpenAI from 'openai';
import { PROFILE_FIELD_CATALOG, missingFieldsInPhase } from '../../domain/interviewProfile.js';
import type { CheckpointReflectionPort } from '../../application/ports/checkpointReflectionPort.js';
import { loadPrompt } from '../prompts/loadPrompt.js';

const SYSTEM_PROMPT = loadPrompt('impactCheckpoint.v1.md');

const FALLBACK_TRANSITION =
  "Thank you for sharing that. Let's talk about what you've tried so far — what's the first thing you did to deal with this?";

export function createCheckpointReflection(client: OpenAI): CheckpointReflectionPort {
  return {
    async reflect(profile, recentTurns) {
      const firstHistoryKey = missingFieldsInPhase(profile, 'history')[0];
      const firstHistoryField = PROFILE_FIELD_CATALOG.find((field) => field.key === firstHistoryKey);
      if (!firstHistoryField) return FALLBACK_TRANSITION;

      const context = {
        knownFields: profile.fields
          .filter((field) => field.status === 'known')
          .map((field) => ({ key: field.key, value: field.value })),
        firstHistoryField: { key: firstHistoryField.key, description: firstHistoryField.description },
        // role filter: user only — recentTurns содержит только реплики пользователя (см. TurnRepository).
        recentTurns: recentTurns.map((turn) => ({ id: turn.id, text: turn.text, tone: turn.tone })),
      };

      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(context) },
        ],
      });

      return completion.choices[0]?.message.content?.trim() || FALLBACK_TRANSITION;
    },
  };
}
