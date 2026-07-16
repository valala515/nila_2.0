// Re-ranks using long-term profile keywords (e.g. interview-derived goals),
// capped so it can't bury a fresh keyword match. Ported from ai_agent_chat's
// buildProfileBoost (courseService.js).
import { hasWord } from './courseQuery.js';

const MAX_PROFILE_BOOST = 3.0;
const BOOST_PER_KEYWORD = 0.5;

export function buildProfileBoost(titleExcerpt: string, profileKeywords: string[]): number {
  if (!profileKeywords.length) return 0;
  const boost = profileKeywords.reduce((sum, keyword) => sum + (hasWord(titleExcerpt, keyword) ? BOOST_PER_KEYWORD : 0), 0);
  return Math.min(boost, MAX_PROFILE_BOOST);
}
