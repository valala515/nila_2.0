import type { Course } from '../../domain/course.js';

// Fetches the full remote course catalog (New Mind Start). Returned courses
// have topics: [] — classification is a domain concern applied by
// syncCourseCatalog, not the adapter's job (CLAUDE.md §1 layering).
export interface CourseCatalogPort {
  listCourses(): Promise<Course[]>;
}
