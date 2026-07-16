import type { Course } from '../../domain/course.js';

export interface CourseRepository {
  saveAll(courses: Course[]): Promise<void>;
  findAll(): Promise<Course[]>;
  findById(id: number): Promise<Course | null>;
}
