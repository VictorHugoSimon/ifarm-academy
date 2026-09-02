export interface StudentLessonProgress {
  lessonId: string
  completed: boolean
  progressPercent: number
  lastPositionSeconds: number
}

export interface StudentCourseProgress {
  courseId: string
  activeLessonId: string
  lessons: StudentLessonProgress[]
}

const KEY = 'ifarm-academy:student-progress:v07'

const initial: StudentCourseProgress = {
  courseId: 'C003',
  activeLessonId: 'L001',
  lessons: [
    { lessonId: 'L001', completed: true, progressPercent: 100, lastPositionSeconds: 480 },
    { lessonId: 'L002', completed: true, progressPercent: 100, lastPositionSeconds: 540 },
    { lessonId: 'L003', completed: false, progressPercent: 40, lastPositionSeconds: 220 },
    { lessonId: 'L004', completed: false, progressPercent: 0, lastPositionSeconds: 0 },
    { lessonId: 'L005', completed: false, progressPercent: 0, lastPositionSeconds: 0 },
  ],
}

export function loadStudentProgress(): StudentCourseProgress {
  const raw = localStorage.getItem(KEY)
  if (!raw) return structuredClone(initial)
  try {
    return JSON.parse(raw) as StudentCourseProgress
  } catch {
    return structuredClone(initial)
  }
}

export function saveStudentProgress(progress: StudentCourseProgress): StudentCourseProgress {
  localStorage.setItem(KEY, JSON.stringify(progress))
  return progress
}

export function calculateProgress(progress: StudentCourseProgress): number {
  if (!progress.lessons.length) return 0
  const total = progress.lessons.reduce((sum, lesson) => sum + lesson.progressPercent, 0)
  return Math.round(total / progress.lessons.length)
}
