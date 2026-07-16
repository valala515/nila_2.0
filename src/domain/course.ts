import type { CourseTopic } from './courseTopic.js';

// A single New Mind Start course, as recommended/stored in nila_2.0. Field
// shape mirrors ai_agent_chat's normaliseCourse() (scripts/syncCourses.js),
// minus fields never used by recommendation (vimeo folder, admin description).
export interface Course {
  readonly id: number;
  readonly title: string;
  readonly slug: string;
  readonly author: string | null;
  readonly rating: number | null;
  readonly ratingCount: number | null;
  readonly thumbUrl: string | null;
  readonly excerpt: string;
  readonly body: string | null;
  readonly lessonTitles: string[];
  readonly lessonsCount: number | null;
  readonly courseFocus: string | null;
  readonly lang: string | null;
  readonly topics: CourseTopic[];
  readonly createdAt: string | null;
}
