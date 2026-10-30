import { firstLogin } from './first-login'
import { access } from './access'
import { services } from './services'
import type { Course, Section } from './types'

// Course registry, in syllabus order. One course per chapter of COURSE-PLAN.md; a course is
// registered here only once it is authored. The pilot (COURSE-PLAN.md, "Build order" 4) is Course 2
// and ◆ Boot (4.6): `services` holds only its boot section until the rest of Course 4 is authored.
export const COURSES: Record<string, Course> = {
  [firstLogin.id]: firstLogin,
  [access.id]: access,
  [services.id]: services,
}

export type { Course, Section }

// slugOf / allSections are the shell's — the slug rule (`<courseId>-<sectionId>`) is part of the
// route contract every recorder drives, so it cannot be a per-repo decision.
export { slugOf, allSections } from '@graphlearning/shell'

export function getCourse(id: string): Course | undefined {
  return COURSES[id]
}
