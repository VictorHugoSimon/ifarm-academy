import { courseBuilderDemo } from '../data/courseBuilderDemo'
import type { CourseBuilderState } from '../domain/builder'

const key = 'ifarm-academy:course-builder'

function normalize(state: CourseBuilderState): CourseBuilderState {
  return {
    ...state,
    modules: (state.modules ?? []).map((module) => ({
      ...module,
      lessons: (module.lessons ?? []).map((lesson) => ({
        ...lesson,
        content: lesson.content && typeof lesson.content === 'object' ? lesson.content : {},
      })),
    })),
  }
}

export const courseBuilderRepository = {
  load(): CourseBuilderState {
    const raw = localStorage.getItem(key)
    if (!raw) return structuredClone(courseBuilderDemo)
    try {
      return normalize(JSON.parse(raw) as CourseBuilderState)
    } catch {
      return structuredClone(courseBuilderDemo)
    }
  },
  save(state: CourseBuilderState): CourseBuilderState {
    const normalized = normalize(state)
    localStorage.setItem(key, JSON.stringify(normalized))
    return normalized
  },
  reset(): CourseBuilderState {
    const state = structuredClone(courseBuilderDemo)
    localStorage.setItem(key, JSON.stringify(state))
    return state
  },
}
