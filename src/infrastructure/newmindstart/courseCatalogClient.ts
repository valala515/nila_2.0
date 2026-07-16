// HTTP adapter for New Mind Start's course catalog API. Ported from
// ai_agent_chat's scripts/syncCourses.js (fetchAllCourses/fetchCourseBody).
import type { CourseCatalogPort } from '../../application/ports/courseCatalogPort.js';
import type { Course } from '../../domain/course.js';
import { mapCourseListItem, type RawCourseDetail, type RawCourseListItem } from './courseMapper.js';

export interface NmsCourseCatalogConfig {
  readonly baseUrl: string;
  readonly botKey: string;
}

const PAGE_SIZE = 100;
const DETAIL_BATCH_SIZE = 5;

interface CourseListResponse {
  readonly data?: RawCourseListItem[];
  readonly pagination?: { pagination_page_count?: number };
}

export function createCourseCatalogClient(config: NmsCourseCatalogConfig): CourseCatalogPort {
  return {
    async listCourses(): Promise<Course[]> {
      const rawCourses = await fetchAllCourseListItems(config);
      const withDetails = await enrichWithDetails(config, rawCourses);
      // English-only — nila_2.0's product content is English-only (CLAUDE.md §6).
      return withDetails.filter((course) => course.lang === null || course.lang === 'en');
    },
  };
}

async function fetchJson<T>(config: NmsCourseCatalogConfig, path: string): Promise<T> {
  const res = await fetch(`${config.baseUrl}${path}`, {
    headers: { Accept: 'application/json', 'x-bot-key': config.botKey },
  });
  if (!res.ok) throw new Error(`NMS API error ${res.status} on ${path}`);
  return (await res.json()) as T;
}

async function fetchAllCourseListItems(config: NmsCourseCatalogConfig): Promise<RawCourseListItem[]> {
  const all: RawCourseListItem[] = [];
  let page = 1;

  for (;;) {
    const path = `/api/courses?per-page=${PAGE_SIZE}&page=${page}&expand=thumb_big,thumb,rating_count,sections&sort=-id`;
    const json = await fetchJson<CourseListResponse>(config, path);
    all.push(...(json.data ?? []));

    const pageCount = json.pagination?.pagination_page_count ?? 1;
    if (page >= pageCount) break;
    page++;
  }

  return all;
}

async function enrichWithDetails(config: NmsCourseCatalogConfig, rawCourses: RawCourseListItem[]): Promise<Course[]> {
  const results: Course[] = [];
  for (let i = 0; i < rawCourses.length; i += DETAIL_BATCH_SIZE) {
    const batch = rawCourses.slice(i, i + DETAIL_BATCH_SIZE);
    const details = await Promise.all(
      batch.map((item) => fetchJson<RawCourseDetail>(config, `/api/courses/${item.id}`).catch(() => ({}) as RawCourseDetail)),
    );
    batch.forEach((raw, index) => {
      // One course's malformed CMS data shouldn't sink the whole catalog sync
      // — skip it and keep going (graceful degradation, CLAUDE.md §3).
      try {
        results.push(mapCourseListItem(raw, details[index] ?? {}));
      } catch (error) {
        console.warn(`[courseCatalogClient] Skipping course id=${raw.id} — mapping failed:`, error);
      }
    });
  }
  return results;
}
