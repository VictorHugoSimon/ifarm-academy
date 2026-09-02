import { courseBuilderDemo } from '../data/courseBuilderDemo'
import type { CourseBuilderState } from '../domain/builder'

const key = 'ifarm-academy:course-builder'

export const courseBuilderRepository = {
  load(): CourseBuilderState {
    const raw = localStorage.getItem(key)
    if (!raw) return structuredClone(courseBuilderDemo)
    try {
      return JSON.parse(raw) as CourseBuilderState
    } catch {
      return structuredClone(courseBuilderDemo)
    }
  },
  save(state: CourseBuilderState): CourseBuilderState {
    localStorage.setItem(key, JSON.stringify(state))
    return state
  },
  reset(): CourseBuilderState {
    const state = structuredClone(courseBuilderDemo)
    localStorage.setItem(key, JSON.stringify(state))
    return state
  },
}
