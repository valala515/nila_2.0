import type { CourseCatalogPort } from '../ports/courseCatalogPort.js';
import type { CourseRepository } from '../ports/courseRepository.js';
import { classifyCourseTopics } from '../../domain/courseTopic.js';

export interface SyncCourseCatalogResult {
  readonly total: number;
  readonly syncedAt: string;
}

/**
 * SPEC: syncCourseCatalog
 * Назначение: обновить локальный каталог курсов из New Mind Start —
 *   получить курсы из порта, классифицировать по темам (index-time
 *   enrichment, CLAUDE.md §3) и сохранить в репозиторий.
 * Входы/Выход: CourseCatalogPort + CourseRepository → количество и время синка
 * Разрешённые side effects: сетевой запрос через catalogPort, запись через repository
 */
export async function syncCourseCatalog(
  catalogPort: CourseCatalogPort,
  repository: CourseRepository,
): Promise<SyncCourseCatalogResult> {
  const rawCourses = await catalogPort.listCourses();
  const classified = rawCourses.map((course) => ({
    ...course,
    topics: classifyCourseTopics(`${course.title} ${course.excerpt}`, course.body ?? ''),
  }));

  await repository.saveAll(classified);

  return { total: classified.length, syncedAt: new Date().toISOString() };
}
