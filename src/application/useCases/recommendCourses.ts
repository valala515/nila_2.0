import type { Course } from '../../domain/course.js';
import type { CourseRepository } from '../ports/courseRepository.js';
import { rankCourses, type RecommendationContext } from '../../domain/courseRecommendation.js';

/**
 * SPEC: recommendCourses
 * Назначение: вернуть топ-N курсов из локального каталога по запросу
 *   пользователя. Не подключён ни к одному transport-слою — вызывающая
 *   сторона (проактивный советник, docs/sprint-plan.md Sprint 4) появится
 *   позже, вместе с tone profile/целями пользователя.
 * Входы/Выход: CourseRepository + запрос + контекст + limit → Course[]
 * Разрешённые side effects: чтение через repository
 */
export async function recommendCourses(
  repository: CourseRepository,
  query: string,
  context: RecommendationContext = {},
  limit = 3,
): Promise<Course[]> {
  const courses = await repository.findAll();
  return rankCourses(courses, query, context, limit);
}
