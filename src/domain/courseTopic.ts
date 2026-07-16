// Deterministic topic taxonomy for the NMS course catalog — ported from
// ai_agent_chat's TOPIC_PROFILE_PATTERNS/QUERY_TOPIC_INDICATORS (courseService.js),
// the only classifier that was actually exercised in production there (the
// LLM-based discovery-profile taxonomy was never wired to a live caller — not
// ported here, see docs/domain-glossary.md).

export type CourseTopic =
  | 'nutrition_gut'
  | 'sleep_rest'
  | 'stress_anxiety'
  | 'parenting_child'
  | 'movement_mobility'
  | 'pain_recovery'
  | 'beauty_anti_aging'
  | 'creativity_spirituality';

// Each topic maps to one or more regexes (OR semantics) — nutrition_gut is
// split across two to stay under the sonarjs regex-complexity limit; it's
// the same alternation set ai_agent_chat used in one literal.
const TOPIC_TEXT_PATTERNS: Record<CourseTopic, RegExp[]> = {
  nutrition_gut: [
    /\b(nutrition|nutritious|food|diet|dieting|eating|healthy eating|gut|gut health|digestion|digest|digestive|bloating|bloated|inflammation|inflamed)\b/i,
    /\b(belly|greens|meal|meals|metabolic|microbiome|probiotic|nourish|nourishing|cook|cooking|recipe|plant.based|calorie|fiber|fibre|antioxidant|vitamin)\b/i,
  ],
  sleep_rest: [/\b(sleep|insomnia|nidra|bedtime|melatonin|circadian|restful sleep|wake up)\b/i],
  stress_anxiety: [/\b(stress|anxiety|anxious|cortisol|burnout|overwhelm|panic|nervous system)\b/i],
  parenting_child: [
    /\b(kids?|children|child|baby|toddler|parenting|mama|pregnancy|prenatal|postnatal|infant|newborn|montessori)\b/i,
  ],
  movement_mobility: [
    /\b(yoga|stretch|stretching|flexibility|mobility|exercise|workout|fitness|movement|dance|pilates|qigong|strength|training)\b/i,
  ],
  pain_recovery: [/\b(pain|ache|relief|injury|spine|back pain|neck pain|knee|joint|rehab|recovery|stiffness|posture)\b/i],
  beauty_anti_aging: [
    /\b(beauty|anti.aging|reverse aging|aging|skin|facial|lifting|wrinkle|collagen|longevity|youthful|rejuven)\b/i,
  ],
  creativity_spirituality: [
    /\b(spiritual|meditation|mindfulness|creative|creativity|sacred|chakra|soul|consciousness|awareness|art therapy)\b/i,
  ],
};

// Subset of topics with words a *user query* signals interest in — narrower
// than TOPIC_TEXT_PATTERNS (which classifies course marketing copy) because a
// short query rarely uses the same vocabulary as curated course text.
const QUERY_TOPIC_INDICATORS: Partial<Record<CourseTopic, string[]>> = {
  nutrition_gut: [
    'nutrition', 'gut', 'digestion', 'digest', 'bloating', 'bloat', 'inflammation',
    'eating', 'food', 'diet', 'greens', 'meal', 'healthy', 'microbiome', 'probiotic', 'nourish',
  ],
  sleep_rest: ['sleep', 'sleeping', 'insomnia', 'bedtime', 'nidra'],
  stress_anxiety: ['stress', 'anxiety', 'anxious', 'cortisol', 'calm', 'nervous'],
  movement_mobility: ['yoga', 'exercise', 'workout', 'fitness', 'stretch', 'dance', 'movement', 'pilates', 'qigong'],
  pain_recovery: ['pain', 'ache', 'hurt', 'spine', 'back', 'knee', 'stiff', 'posture'],
  parenting_child: ['kids', 'children', 'child', 'baby', 'parenting', 'pregnancy'],
};

/**
 * SPEC: classifyCourseTopics
 * Назначение: детерминированно определить тематические кластеры курса по
 *   title+excerpt и body — сохраняется на Course.topics при синхронизации
 *   каталога (index-time enrichment, CLAUDE.md §3), а не пересчитывается на
 *   каждый запрос рекомендации.
 * Входы/Выход: titleExcerpt (короткий курируемый текст) + body (полный текст) → CourseTopic[]
 * Разрешённые side effects: нет (чистая функция)
 * Инварианты: совпадение в titleExcerpt достаточно с одного вхождения; в body
 *   требуется ≥2 разных вхождения, иначе один случайный термин в шаге
 *   инструкции присваивает курсу неверную тему (см. ai_agent_chat regression).
 */
export function classifyCourseTopics(titleExcerpt: string, body: string): CourseTopic[] {
  const topics: CourseTopic[] = [];
  for (const [topic, patterns] of Object.entries(TOPIC_TEXT_PATTERNS) as [CourseTopic, RegExp[]][]) {
    if (patterns.some((pattern) => pattern.test(titleExcerpt))) {
      topics.push(topic);
      continue;
    }
    if (body && countDistinctMatches(patterns, body) >= 2) topics.push(topic);
  }
  return topics;
}

function countDistinctMatches(patterns: RegExp[], text: string): number {
  const hits = new Set<string>();
  for (const pattern of patterns) {
    const globalPattern = new RegExp(pattern.source, 'gi');
    let match: RegExpExecArray | null;
    while ((match = globalPattern.exec(text)) !== null) hits.add(match[0].toLowerCase());
  }
  return hits.size;
}

/**
 * SPEC: detectQueryTopics
 * Назначение: по словам запроса пользователя определить, каких тематических
 *   кластеров он касается — используется в noise guard (courseRecommendation.ts),
 *   чтобы отсеять курсы, совпавшие только по случайному слову в body.
 * Входы/Выход: токенизированные слова запроса → Set<CourseTopic>
 * Разрешённые side effects: нет (чистая функция)
 */
export function detectQueryTopics(rawWords: string[]): Set<CourseTopic> {
  const topics = new Set<CourseTopic>();
  for (const word of rawWords) {
    for (const [topic, indicators] of Object.entries(QUERY_TOPIC_INDICATORS) as [CourseTopic, string[]][]) {
      if (indicators.includes(word)) topics.add(topic);
    }
  }
  return topics;
}
