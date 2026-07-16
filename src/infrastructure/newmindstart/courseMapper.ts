// Maps NMS's raw /api/courses JSON shape to the domain Course type. Ported
// from ai_agent_chat's normaliseCourse (scripts/syncCourses.js) — strips
// heavy fields never used by recommendation (vimeo folder, admin description).
import type { Course } from '../../domain/course.js';
import { parseCourseDescription } from './courseDescriptionParser.js';

export interface RawAuthorInfo {
  readonly name?: string;
}

// NMS returns `false` (not null) for an unset thumbnail on some courses —
// resolveThumbUrl() below normalizes that back to null.
type NullableThumb = string | boolean | null;

export interface RawCourseListItem {
  readonly id: number;
  readonly title: string;
  readonly slug: string;
  readonly author_info?: string | RawAuthorInfo[];
  readonly rating?: number | null;
  readonly rating_count?: number | null;
  readonly thumb_big?: NullableThumb;
  readonly thumb?: NullableThumb;
  readonly thumbnail?: NullableThumb;
  readonly excerpt?: string | null;
  readonly sections?: ReadonlyArray<{ lessons?: ReadonlyArray<{ title?: string }> }>;
  readonly lang?: string | null;
  readonly locale?: string | null;
  readonly created_at?: string | null;
}

export interface RawCourseDetail {
  readonly description?: unknown;
  readonly data?: { description?: unknown };
}

const MAX_EXCERPT_LENGTH = 300;

function extractLessonTitles(raw: RawCourseListItem): string[] {
  return (raw.sections ?? [])
    .flatMap((section) => section.lessons ?? [])
    .map((lesson) => lesson.title)
    .filter((title): title is string => Boolean(title));
}

function resolveThumbUrl(raw: RawCourseListItem): string | null {
  const candidate = raw.thumb_big ?? raw.thumb ?? raw.thumbnail ?? null;
  return typeof candidate === 'string' ? candidate : null;
}

export function mapCourseListItem(raw: RawCourseListItem, detail: RawCourseDetail): Course {
  const parsed = parseCourseDescription(detail.description ?? detail.data?.description ?? null);

  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    author: parseAuthorName(raw.author_info),
    rating: raw.rating ?? null,
    ratingCount: raw.rating_count ?? null,
    thumbUrl: resolveThumbUrl(raw),
    excerpt: stripHtml(raw.excerpt ?? '').slice(0, MAX_EXCERPT_LENGTH),
    body: parsed.body,
    lessonTitles: extractLessonTitles(raw),
    lessonsCount: parsed.lessonsCount,
    courseFocus: parsed.courseFocus,
    lang: raw.lang ?? raw.locale ?? null,
    topics: [],
    createdAt: raw.created_at ?? null,
  };
}

function parseAuthorName(authorInfo: string | RawAuthorInfo[] | undefined): string | null {
  try {
    const info = typeof authorInfo === 'string' ? JSON.parse(authorInfo) : authorInfo;
    return Array.isArray(info) ? (info[0]?.name ?? null) : null;
  } catch {
    return null;
  }
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]{0,500}>/g, '').trim();
}
