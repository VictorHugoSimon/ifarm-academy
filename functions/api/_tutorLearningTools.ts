import { scoreTutorEvidence, type TutorEvidence } from './_tutor'

export type TutorLearningToolType = 'summary' | 'flashcards' | 'practice_exercises'

export interface TutorSummaryArtifact {
  toolType: 'summary'
  title: string
  bullets: Array<{ text: string; sourceId: string }>
}

export interface TutorFlashcardsArtifact {
  toolType: 'flashcards'
  cards: Array<{ front: string; back: string; sourceId: string }>
}

export interface TutorPracticeArtifact {
  toolType: 'practice_exercises'
  disclaimer: string
  items: Array<{ prompt: string; studyReference: string; sourceId: string }>
}

export type TutorLearningArtifact = TutorSummaryArtifact | TutorFlashcardsArtifact | TutorPracticeArtifact

function clampText(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) return normalized
  const cut = normalized.lastIndexOf(' ', max)
  return `${normalized.slice(0, cut > max * 0.6 ? cut : max).trim()}…`
}

function uniqueByLesson(rows: TutorEvidence[], limit: number): TutorEvidence[] {
  const output: TutorEvidence[] = []
  const lessons = new Set<string>()
  for (const row of rows) {
    if (!lessons.has(row.lessonId)) {
      output.push(row)
      lessons.add(row.lessonId)
      if (output.length >= limit) return output
    }
  }
  for (const row of rows) {
    if (!output.some((item) => item.id === row.id)) output.push(row)
    if (output.length >= limit) break
  }
  return output
}

export function selectTutorLearningEvidence(
  candidates: Omit<TutorEvidence, 'score'>[],
  focus = '',
  limit = 8,
): TutorEvidence[] {
  const safeLimit = Math.min(12, Math.max(3, Math.trunc(limit)))
  const query = focus.replace(/\s+/g, ' ').trim()
  if (query.length >= 3) {
    return uniqueByLesson(scoreTutorEvidence(query, candidates), safeLimit)
  }

  const baseline = candidates
    .map((row, index) => ({ ...row, score: Math.max(1, 1000 - index) }))
    .sort((a, b) => {
      if (a.sourceType !== b.sourceType) return a.sourceType === 'lesson_body' ? -1 : 1
      return b.score - a.score
    })
  return uniqueByLesson(baseline, safeLimit)
}

export function buildTutorLearningArtifact(
  toolType: TutorLearningToolType,
  evidence: TutorEvidence[],
  courseTitle: string,
): TutorLearningArtifact {
  const sources = evidence.slice(0, toolType === 'summary' ? 8 : 6)
  if (!sources.length) throw new Error('insufficient_evidence')

  if (toolType === 'summary') {
    return {
      toolType,
      title: `Resumo de estudo — ${clampText(courseTitle, 120)}`,
      bullets: sources.map((item) => ({
        text: `${item.sourceTitle}: ${clampText(item.text, 360)}`,
        sourceId: item.id,
      })),
    }
  }

  if (toolType === 'flashcards') {
    return {
      toolType,
      cards: sources.map((item, index) => ({
        front: `Card ${index + 1}: o que o material apresenta em “${clampText(item.sourceTitle, 100)}”?`,
        back: clampText(item.text, 420),
        sourceId: item.id,
      })),
    }
  }

  return {
    toolType,
    disclaimer: 'Exercícios de prática para estudo. Não alteram nota, tentativa de prova, progresso regulatório ou certificado.',
    items: sources.map((item, index) => ({
      prompt: `Exercício ${index + 1}: explique com suas palavras o ponto central do trecho “${clampText(item.sourceTitle, 100)}” e compare sua resposta com a referência de estudo.`,
      studyReference: clampText(item.text, 420),
      sourceId: item.id,
    })),
  }
}

export function validateTutorLearningArtifact(
  artifact: TutorLearningArtifact,
  allowedSourceIds: string[],
): { valid: true } | { valid: false; reason: string } {
  const allowed = new Set(allowedSourceIds)
  const ids = artifact.toolType === 'summary'
    ? artifact.bullets.map((item) => item.sourceId)
    : artifact.toolType === 'flashcards'
      ? artifact.cards.map((item) => item.sourceId)
      : artifact.items.map((item) => item.sourceId)
  if (!ids.length) return { valid: false, reason: 'artifact_empty' }
  if (ids.some((id) => !allowed.has(id))) return { valid: false, reason: 'source_not_allowed' }

  if (artifact.toolType === 'summary') {
    if (artifact.bullets.length > 8 || artifact.bullets.some((item) => !item.text.trim() || item.text.length > 500)) {
      return { valid: false, reason: 'summary_contract_invalid' }
    }
  } else if (artifact.toolType === 'flashcards') {
    if (artifact.cards.length > 6 || artifact.cards.some((item) => !item.front.trim() || !item.back.trim() || item.front.length > 220 || item.back.length > 500)) {
      return { valid: false, reason: 'flashcard_contract_invalid' }
    }
  } else if (artifact.items.length > 6 || artifact.items.some((item) => !item.prompt.trim() || !item.studyReference.trim() || item.prompt.length > 360 || item.studyReference.length > 500)) {
    return { valid: false, reason: 'practice_contract_invalid' }
  }

  return { valid: true }
}
