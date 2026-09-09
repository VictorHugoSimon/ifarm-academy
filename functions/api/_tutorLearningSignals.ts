export type TutorLearningSignalType =
  | 'course_completed'
  | 'continue_required_lessons'
  | 'assessment_ready'
  | 'assessment_in_progress'
  | 'manual_review_pending'
  | 'assessment_review_recommended'
  | 'assessment_approved_lessons_pending'

export interface LearningLessonState {
  id: string
  title: string
  required: boolean
  position: number
  progressPercent: number
  completedAt?: string | null
}

export interface LearningAttemptState {
  id: string
  attemptNumber: number
  status: 'in_progress' | 'submitted' | 'manual_review' | 'approved' | 'failed'
  finalPercentage?: number | null
}

export interface TutorLearningSignal {
  type: TutorLearningSignalType
  tone: 'info' | 'attention' | 'success'
  title: string
  message: string
  recommendedLessonId?: string
  facts: Record<string, number | string | boolean | null>
}

export interface TutorLearningSignalInput {
  cycleStatus: 'active' | 'completed' | 'cancelled'
  lessons: LearningLessonState[]
  assessmentRequired: boolean
  minimumScore?: number | null
  attempts: LearningAttemptState[]
}

export interface TutorLearningSignalResult {
  signals: TutorLearningSignal[]
  metrics: {
    requiredLessons: number
    completedRequiredLessons: number
    incompleteRequiredLessons: number
    failedAttempts: number
    latestAttemptStatus: string | null
    latestScore: number | null
  }
}

export function buildTutorLearningSignals(input: TutorLearningSignalInput): TutorLearningSignalResult {
  const required = input.lessons.filter((lesson) => lesson.required)
  const completed = required.filter((lesson) => lesson.progressPercent >= 100 || Boolean(lesson.completedAt))
  const incomplete = required
    .filter((lesson) => lesson.progressPercent < 100 && !lesson.completedAt)
    .sort((a, b) => a.position - b.position)
  const attempts = [...input.attempts].sort((a, b) => b.attemptNumber - a.attemptNumber)
  const latest = attempts[0] ?? null
  const failedAttempts = attempts.filter((attempt) => attempt.status === 'failed').length
  const signals: TutorLearningSignal[] = []

  if (input.cycleStatus === 'completed') {
    signals.push({
      type: 'course_completed',
      tone: 'success',
      title: 'Ciclo concluído',
      message: 'Este ciclo acadêmico já está concluído. Você pode usar o Tutor para revisão do conteúdo publicado.',
      facts: { completedRequiredLessons: completed.length, requiredLessons: required.length },
    })
  } else if (incomplete.length > 0) {
    const next = incomplete[0]
    signals.push({
      type: 'continue_required_lessons',
      tone: 'info',
      title: incomplete.length === 1 ? 'Há 1 aula obrigatória pendente' : `Há ${incomplete.length} aulas obrigatórias pendentes`,
      message: next.progressPercent > 0
        ? `Retome “${next.title}”, atualmente com ${next.progressPercent}% registrado.`
        : `A próxima aula obrigatória disponível para estudo é “${next.title}”.`,
      recommendedLessonId: next.id,
      facts: {
        incompleteRequiredLessons: incomplete.length,
        nextLessonProgressPercent: next.progressPercent,
      },
    })
  }

  if (input.assessmentRequired && input.cycleStatus !== 'completed') {
    if (!latest && incomplete.length === 0) {
      signals.push({
        type: 'assessment_ready',
        tone: 'info',
        title: 'Conteúdo obrigatório concluído',
        message: 'As aulas obrigatórias deste ciclo estão concluídas e a avaliação obrigatória ainda não foi iniciada.',
        facts: { assessmentRequired: true },
      })
    } else if (latest?.status === 'in_progress' || latest?.status === 'submitted') {
      signals.push({
        type: 'assessment_in_progress',
        tone: 'info',
        title: 'Há uma avaliação em andamento',
        message: `A tentativa ${latest.attemptNumber} ainda não possui resultado final.`,
        facts: { attemptNumber: latest.attemptNumber, status: latest.status },
      })
    } else if (latest?.status === 'manual_review') {
      signals.push({
        type: 'manual_review_pending',
        tone: 'info',
        title: 'Avaliação aguardando revisão',
        message: `A tentativa ${latest.attemptNumber} está aguardando correção manual. Não é necessário refazer a avaliação neste momento.`,
        facts: { attemptNumber: latest.attemptNumber },
      })
    } else if (latest?.status === 'failed') {
      const score = latest.finalPercentage == null ? null : Number(latest.finalPercentage)
      signals.push({
        type: 'assessment_review_recommended',
        tone: 'attention',
        title: 'Revisão de conteúdo recomendada antes de nova tentativa',
        message: score == null || input.minimumScore == null
          ? 'A tentativa mais recente não foi aprovada. Revise as fontes autorizadas do curso antes de uma nova tentativa, quando permitida.'
          : `A tentativa mais recente registrou ${score}% e a política publicada exige ${input.minimumScore}%. Revise o conteúdo antes de uma nova tentativa, quando permitida.`,
        facts: {
          failedAttempts,
          latestScore: score,
          minimumScore: input.minimumScore ?? null,
        },
      })
    } else if (latest?.status === 'approved' && incomplete.length > 0) {
      signals.push({
        type: 'assessment_approved_lessons_pending',
        tone: 'info',
        title: 'Avaliação aprovada, aulas obrigatórias pendentes',
        message: 'A avaliação deste ciclo está aprovada, mas ainda existem aulas obrigatórias não concluídas.',
        facts: { incompleteRequiredLessons: incomplete.length, attemptNumber: latest.attemptNumber },
      })
    }
  }

  return {
    signals,
    metrics: {
      requiredLessons: required.length,
      completedRequiredLessons: completed.length,
      incompleteRequiredLessons: incomplete.length,
      failedAttempts,
      latestAttemptStatus: latest?.status ?? null,
      latestScore: latest?.finalPercentage == null ? null : Number(latest.finalPercentage),
    },
  }
}
