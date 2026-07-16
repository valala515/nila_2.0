// Synonym bridge — maps a user's word (or its stem) to additional search
// terms so course matching survives vocabulary gaps (user says "singing",
// courses say "voice"/"vocal"). Ported as-is from ai_agent_chat's SYNONYMS
// (courseService.js) — a flat data catalog, no logic, so it doesn't need
// deep-module scrutiny (see memory: flat data catalogs are fine).
//
// The multilingual variant (SYNONYMS_MULTILINGUAL in ai_agent_chat) is not
// ported: nila_2.0's product content is English-only for now (CLAUDE.md §6).

export const COURSE_SYNONYMS: Record<string, string[]> = {
  // Voice / music
  sing: ['voice', 'vocal', 'song', 'music'],
  singing: ['voice', 'vocal', 'song', 'music', 'sing'],
  singer: ['voice', 'vocal', 'sing'],
  voice: ['vocal', 'sing', 'throat', 'sound'],
  vocal: ['voice', 'sing', 'throat'],
  song: ['sing', 'voice', 'music'],
  music: ['sound', 'sing', 'musical'],
  throat: ['voice', 'vocal'],
  chant: ['sing', 'voice', 'vocal', 'sound'],
  hum: ['sing', 'voice', 'sound'],

  // Sleep — "rest" deliberately excluded, \brest\b still matches "restore"/"restful".
  sleep: ['insomnia', 'nidra', 'sleepy', 'sleepless', 'bedtime', 'melatonin'],
  sleeping: ['sleep', 'insomnia', 'nidra'],
  insomnia: ['sleep', 'nidra', 'sleepless'],
  nidra: ['sleep', 'insomnia', 'yoga', 'relax'],
  bedtime: ['sleep', 'insomnia', 'nidra'],
  melatonin: ['sleep', 'insomnia'],

  // Stress / anxiety / nervous system
  stress: ['anxiety', 'cortisol', 'nervous', 'tension'],
  anxiety: ['stress', 'anxious', 'nervous', 'cortisol'],
  anxious: ['anxiety', 'stress', 'nervous'],
  worry: ['anxiety', 'stress'],
  panic: ['anxiety', 'stress', 'nervous'],
  nervous: ['anxiety', 'stress', 'cortisol'],
  cortisol: ['stress', 'anxiety', 'nervous'],
  overwhelm: ['stress', 'anxiety', 'burnout'],
  burnout: ['stress', 'anxiety', 'overwhelm', 'exhaust'],

  // Breathing
  breathe: ['breath', 'pranayama', 'lung', 'oxygen'],
  breathing: ['breath', 'pranayama', 'lung'],
  breath: ['breathing', 'pranayama', 'lung'],
  pranayama: ['breath', 'yoga', 'meditation'],
  oxygen: ['breath', 'breathing'],

  // Meditation / mindfulness
  meditate: ['meditation', 'mindful', 'calm', 'nidra'],
  meditating: ['meditation', 'mindful', 'calm'],
  meditation: ['mindful', 'calm', 'nidra', 'mindfulness'],
  mindful: ['meditation', 'calm', 'awareness', 'mindfulness'],
  mindfulness: ['meditation', 'mindful', 'calm'],
  calm: ['meditation', 'relax', 'peace', 'stress'],
  relax: ['calm', 'meditation', 'nidra', 'sleep'],

  // Yoga / movement
  yoga: ['stretch', 'asana', 'flexibility', 'pose'],
  stretch: ['yoga', 'flexibility', 'mobility'],
  posture: ['spine', 'alignment', 'back'],
  flexibility: ['stretch', 'yoga', 'mobility'],
  mobility: ['flexibility', 'stretch', 'joint'],
  warmup: ['mobility', 'stretch', 'movement', 'exercise'],

  // Gut / digestion / nutrition cluster
  gut: ['digestion', 'digest', 'belly', 'intestine', 'bowel', 'nutrition', 'bloating', 'inflammation'],
  digestion: ['gut', 'digest', 'belly', 'nutrition', 'bloating', 'inflammation'],
  digest: ['gut', 'digestion', 'belly', 'stomach', 'nutrition'],
  belly: ['gut', 'digestion', 'digest', 'abdomen'],
  stomach: ['gut', 'digestion', 'digest', 'belly'],
  bloat: ['gut', 'digestion', 'belly', 'inflammation'],
  bloating: ['gut', 'digestion', 'belly', 'inflammation'],
  inflammation: ['gut', 'digestion', 'nutrition', 'belly'],

  // Physical pain — "tension" deliberately excludes "relief" (see below), it
  // leaked into pain-course ranking via synonym chaining in ai_agent_chat.
  pain: ['ache', 'sore', 'hurt', 'relief', 'chronic'],
  ache: ['pain', 'sore', 'hurt', 'relief'],
  sore: ['pain', 'ache', 'tight', 'stiff'],
  hurt: ['pain', 'ache', 'injury'],
  rehab: ['recovery', 'mobility', 'healing', 'relief'],
  rehabilitation: ['recovery', 'mobility', 'healing', 'relief'],
  knee: ['knees', 'kneecap'],
  knees: ['knee', 'kneecap'],
  stiff: ['tight', 'mobility', 'stretch', 'joint'],
  tight: ['stiff', 'stretch', 'mobility'],
  tension: ['stress', 'anxiety', 'nervous'],

  // Energy / fatigue
  energy: ['vitality', 'fatigue'],
  tired: ['fatigue', 'energy', 'exhaust'],
  fatigue: ['tired', 'energy', 'exhaust'],
  exhaust: ['fatigue', 'tired', 'burnout'],
  vitality: ['energy', 'fatigue'],

  // Weight / fat loss
  weight: ['slim', 'diet', 'loss'],
  lose: ['loss', 'slim', 'fat', 'weight'],
  loss: ['lose', 'slim', 'fat', 'weight'],
  slim: ['weight', 'diet'],

  // Nutrition / healthy eating / gut
  nutrition: ['diet', 'food', 'eating', 'gut', 'digestion', 'digest', 'bloating', 'inflammation', 'belly', 'greens', 'meal'],
  diet: ['nutrition', 'food', 'eating', 'gut', 'digestion', 'weight'],
  eating: ['nutrition', 'diet', 'food', 'gut'],
  healthy: ['nutrition', 'diet', 'eating'],
  greens: ['vegetables', 'food', 'nutrition', 'healthy', 'eating'],
  meal: ['food', 'nutrition', 'diet', 'eating'],

  // Focus / brain
  focus: ['attention', 'concentration', 'brain'],
  attention: ['focus', 'concentration', 'brain'],
  adhd: ['focus', 'attention', 'concentration'],

  // Emotional / trauma
  emotion: ['feeling', 'emotional', 'trauma'],
  trauma: ['emotional', 'therapy', 'healing', 'release'],
  heal: ['healing', 'therapy', 'recovery'],
  healing: ['therapy', 'recover', 'release'],
  release: ['healing', 'trauma', 'emotion'],

  // Sound healing
  bowl: ['singing', 'sound', 'healing'],
  sound: ['music', 'singing', 'bowl', 'vibration'],

  // Jaw / face
  jaw: ['tmj', 'myofunctional', 'facial', 'bite'],
  face: ['jaw', 'facial', 'skin'],

  // Hormones / women
  hormone: ['cortisol', 'estrogen', 'menopause', 'thyroid'],
  menopause: ['hormone', 'women', 'aging'],

  // Somatic / embodiment / movement / dance
  somatic: ['embodiment', 'movement', 'nervous', 'dance', 'awareness'],
  dance: ['movement', 'embodiment', 'expressive', 'flow'],
  embodiment: ['somatic', 'movement', 'dance'],
  grounding: ['somatic', 'embodiment', 'nervous'],
  expressive: ['dance', 'movement', 'embodiment'],
  feminine: ['dance', 'embodiment', 'goddess', 'shakti', 'women'],
  spiritual: ['meditation', 'mindfulness', 'contemplation', 'sacred'],
};
