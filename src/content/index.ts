import { firstLogin } from './first-login'
import { access } from './access'
import { software } from './software'
import { services } from './services'
import { web } from './web'
import { automate } from './automate'
import { operate } from './operate'
import type { Course, Section } from './types'

// Course registry, in syllabus order. One course per chapter of COURSE-PLAN.md; a course is
// registered here only once it is authored. All 7 are.
export const COURSES: Record<string, Course> = {
  [firstLogin.id]: firstLogin,
  [access.id]: access,
  [software.id]: software,
  [services.id]: services,
  [web.id]: web,
  [automate.id]: automate,
  [operate.id]: operate,
}

export type { Course, Section }

// slugOf / allSections are the shell's — the slug rule (`<courseId>-<sectionId>`) is part of the
// route contract every recorder drives, so it cannot be a per-repo decision.
export { slugOf, allSections } from '@graphlearning/shell'

export function getCourse(id: string): Course | undefined {
  return COURSES[id]
}
