export const TONE_LABELS = [
  'calm',
  'stressed',
  'anxious',
  'sad',
  'frustrated',
  'positive',
  'neutral',
] as const;

export type ToneLabel = (typeof TONE_LABELS)[number];
