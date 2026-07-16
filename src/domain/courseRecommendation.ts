// Course recommendation engine — ranks the local course catalog against a
// free-text query. Ported from ai_agent_chat's findRelevantCourses
// (courseService.js), decomposed into small pure functions across this file
// and its sibling domain modules (courseQuery, courseTopic, courseTopicBoost,
// courseProfileBoost, courseFreshness, courseAudienceGuard) to stay under
// CLAUDE.md's file/function/complexity limits — the original was a single
// 798-line file.
import type { Course } from './course.js';
import { expandWord, matchesHaystack, tokenizeQuery } from './courseQuery.js';
import { detectsChildQuery, passesAudienceGuard, type UserAudienceProfile } from './courseAudienceGuard.js';
import { detectQueryTopics } from './courseTopic.js';
import { buildTopicBoost } from './courseTopicBoost.js';
import { buildProfileBoost } from './courseProfileBoost.js';
import { computeFreshnessRange, courseFreshness } from './courseFreshness.js';

export interface RecommendationContext {
  readonly userProfile?: UserAudienceProfile;
  readonly profileKeywords?: string[];
  readonly recentlyRecommendedIds?: ReadonlySet<string>;
  readonly excludeCourseIds?: ReadonlySet<string>;
}

interface CourseMatch {
  readonly matchCount: number;
  readonly topTierMatchCount: number;
  readonly score: number;
}

const RECENCY_PENALTY = -7.0;

interface CourseHaystacks {
  readonly title: string;
  readonly mainTitle: string;
  readonly author: string;
  readonly excerpt: string;
  readonly lessonText: string;
  readonly body: string;
}

function buildHaystacks(course: Course): CourseHaystacks {
  const titleRaw = course.title.toLowerCase();
  return {
    // De-hyphenated variant appended so "e-motion" matches query "emotion".
    title: `${titleRaw} ${titleRaw.replace(/-/g, '')}`,
    mainTitle: titleRaw.split(':')[0] ?? titleRaw,
    author: (course.author ?? '').toLowerCase(),
    excerpt: course.excerpt.toLowerCase(),
    lessonText: course.lessonTitles.join(' ').toLowerCase(),
    body: (course.body ?? '').toLowerCase(),
  };
}

interface TierMatch {
  readonly points: number;
  readonly isTopTier: boolean;
}

// Tiered scoring — WHERE a keyword matches matters as much as WHETHER it
// matches: title/author outrank excerpt, which outranks lesson titles and
// body text (curated fields are a stronger relevance signal than prose).
function matchVariantGroup(haystacks: CourseHaystacks, variants: string[]): TierMatch | null {
  if (matchesHaystack(haystacks.title, variants)) {
    const [firstVariant] = variants;
    const isDirectMainTitleMatch = firstVariant !== undefined && matchesHaystack(haystacks.mainTitle, [firstVariant]);
    return { points: isDirectMainTitleMatch ? 5.0 : 3.0, isTopTier: true };
  }
  if (matchesHaystack(haystacks.author, variants)) return { points: 3.0, isTopTier: true };
  if (matchesHaystack(haystacks.excerpt, variants)) return { points: 1.0, isTopTier: true };
  if (matchesHaystack(haystacks.lessonText, variants)) return { points: 0.4, isTopTier: false };
  if (matchesHaystack(haystacks.body, variants)) return { points: 0.3, isTopTier: false };
  return null;
}

function scoreCourseMatch(course: Course, wordVariants: string[][]): CourseMatch {
  const haystacks = buildHaystacks(course);
  let matchCount = 0;
  let topTierMatchCount = 0;
  let score = 0;

  for (const variants of wordVariants) {
    const tier = matchVariantGroup(haystacks, variants);
    if (!tier) continue;
    matchCount++;
    if (tier.isTopTier) topTierMatchCount++;
    score += tier.points;
  }

  return { matchCount, topTierMatchCount, score };
}

function computeMinRelevance(rawWordCount: number, variantGroupCount: number): number {
  const matchRatio = rawWordCount >= 3 ? 0.5 : 0.4;
  return Math.max(1, Math.ceil(variantGroupCount * matchRatio));
}

// Body-only noise guard: when every keyword matched only in the body (not
// title/author/excerpt), cross-check the course's own topic classification
// against what the query is actually about — prevents an incidental body-text
// hit (e.g. a mobility course mentioning "nutrition" once) from ranking for
// an unrelated query.
function passesNoiseGuard(course: Course, match: CourseMatch, queryTopics: ReadonlySet<string>): boolean {
  if (match.topTierMatchCount > 0 || queryTopics.size === 0) return true;
  return course.topics.some((topic) => queryTopics.has(topic));
}

/**
 * SPEC: rankCourses
 * Назначение: найти и отранжировать курсы каталога по текстовому запросу
 *   пользователя — единственная точка входа рекомендательного движка.
 * Входы/Выход: полный каталог + запрос + контекст (профиль/ключевые
 *   слова/недавние рекомендации/исключения) + limit → топ-N Course
 * Разрешённые side effects: нет (чистая функция)
 * Инварианты: пустой/полностью стоп-слова запрос → []; курсы для чужого
 *   audience-сегмента исключаются до скоринга, не после.
 */
export function rankCourses(courses: readonly Course[], query: string, context: RecommendationContext = {}, limit = 3): Course[] {
  const rawWords = tokenizeQuery(query);
  if (!rawWords.length) return [];

  const wordVariants = rawWords.map(expandWord);
  const minRelevance = computeMinRelevance(rawWords.length, wordVariants.length);
  const userAsksAboutChild = detectsChildQuery(query);
  const queryTopics = detectQueryTopics(rawWords);
  const freshnessRange = computeFreshnessRange(courses);

  const {
    userProfile = {},
    profileKeywords = [],
    recentlyRecommendedIds = new Set<string>(),
    excludeCourseIds = new Set<string>(),
  } = context;

  return courses
    .filter((course) => passesAudienceGuard(course, userProfile, userAsksAboutChild) && !excludeCourseIds.has(String(course.id)))
    .flatMap((course) => {
      const match = scoreCourseMatch(course, wordVariants);
      if (match.matchCount < minRelevance || !passesNoiseGuard(course, match, queryTopics)) return [];

      const titleExcerpt = `${course.title} ${course.excerpt}`;
      const total =
        match.score +
        buildTopicBoost(course, query) +
        courseFreshness(course, freshnessRange) +
        buildProfileBoost(titleExcerpt, profileKeywords) +
        (recentlyRecommendedIds.has(String(course.id)) ? RECENCY_PENALTY : 0);

      return [{ course, total }];
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
    .map(({ course }) => course);
}
