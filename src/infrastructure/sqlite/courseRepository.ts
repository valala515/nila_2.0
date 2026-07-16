import type Database from 'better-sqlite3';
import type { CourseRepository } from '../../application/ports/courseRepository.js';
import type { Course } from '../../domain/course.js';
import type { CourseTopic } from '../../domain/courseTopic.js';

interface CourseRow {
  id: number;
  title: string;
  slug: string;
  author: string | null;
  rating: number | null;
  rating_count: number | null;
  thumb_url: string | null;
  excerpt: string;
  body: string | null;
  lesson_titles_json: string;
  lessons_count: number | null;
  course_focus: string | null;
  lang: string | null;
  topics_json: string;
  created_at: string | null;
}

function rowToCourse(row: CourseRow): Course {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    author: row.author,
    rating: row.rating,
    ratingCount: row.rating_count,
    thumbUrl: row.thumb_url,
    excerpt: row.excerpt,
    body: row.body,
    lessonTitles: JSON.parse(row.lesson_titles_json) as string[],
    lessonsCount: row.lessons_count,
    courseFocus: row.course_focus,
    lang: row.lang,
    topics: JSON.parse(row.topics_json) as CourseTopic[],
    createdAt: row.created_at,
  };
}

export function createCourseRepository(db: Database.Database): CourseRepository {
  const deleteAll = db.prepare('DELETE FROM courses');
  const insert = db.prepare(`
    INSERT INTO courses (
      id, title, slug, author, rating, rating_count, thumb_url, excerpt, body,
      lesson_titles_json, lessons_count, course_focus, lang, topics_json, created_at, synced_at_iso
    ) VALUES (
      @id, @title, @slug, @author, @rating, @ratingCount, @thumbUrl, @excerpt, @body,
      @lessonTitlesJson, @lessonsCount, @courseFocus, @lang, @topicsJson, @createdAt, @syncedAtIso
    )
  `);
  const selectAll = db.prepare('SELECT * FROM courses ORDER BY id DESC');
  const selectById = db.prepare('SELECT * FROM courses WHERE id = ?');

  return {
    async saveAll(courses: Course[]): Promise<void> {
      const syncedAtIso = new Date().toISOString();
      const replaceAll = db.transaction((items: Course[]) => {
        deleteAll.run();
        for (const course of items) {
          insert.run({
            id: course.id,
            title: course.title,
            slug: course.slug,
            author: course.author,
            rating: course.rating,
            ratingCount: course.ratingCount,
            thumbUrl: course.thumbUrl,
            excerpt: course.excerpt,
            body: course.body,
            lessonTitlesJson: JSON.stringify(course.lessonTitles),
            lessonsCount: course.lessonsCount,
            courseFocus: course.courseFocus,
            lang: course.lang,
            topicsJson: JSON.stringify(course.topics),
            createdAt: course.createdAt,
            syncedAtIso,
          });
        }
      });
      replaceAll(courses);
    },

    async findAll(): Promise<Course[]> {
      return (selectAll.all() as CourseRow[]).map(rowToCourse);
    },

    async findById(id: number): Promise<Course | null> {
      const row = selectById.get(id) as CourseRow | undefined;
      return row ? rowToCourse(row) : null;
    },
  };
}
