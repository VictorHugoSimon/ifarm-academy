import { authenticatedJson } from './authenticatedFetch'

export type TutorLearningToolType = 'summary' | 'flashcards' | 'practice_exercises'

export interface TutorLearningCitation {
  sourceId: string
  lessonId: string
  lessonTitle: string
  sourceType: 'lesson_body' | 'lesson_instructions'
  excerpt: string
}

export type TutorLearningArtifact =
  | {
      toolType: 'summary'
      title: string
      bullets: Array<{ text: string; sourceId: string }>
    }
  | {
      toolType: 'flashcards'
      cards: Array<{ front: string; back: string; sourceId: string }>
    }
  | {
      toolType: 'practice_exercises'
      disclaimer: string
      items: Array<{ prompt: string; studyReference: string; sourceId: string }>
    }

export interface TutorLearningToolResult {
  courseId: string
  courseTitle: string
  toolType: TutorLearningToolType
  mode: 'evidence_only'
  artifact: TutorLearningArtifact
  citations: TutorLearningCitation[]
  sourceCourseUpdatedAt: string
  generatedAt: string
  focusUsed: boolean
  officialAssessment: false
  affectsGrade: false
  affectsCertificate: false
  providerAttempted: false
}

export async function generateTutorLearningTool(input: {
  courseId: string
  toolType: TutorLearningToolType
  focus?: string
}): Promise<TutorLearningToolResult> {
  const result = await authenticatedJson<{ data: TutorLearningToolResult }>('/api/tutor-tools', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  return result.data
}
