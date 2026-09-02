export interface LessonContent {
  body?: string
  instructions?: string
  externalUrl?: string
  label?: string
  fileName?: string
  provider?: string
  providerRef?: string
  linkedQuizId?: string
}

const textFields: Array<keyof LessonContent> = [
  'body', 'instructions', 'label', 'fileName', 'provider', 'providerRef', 'linkedQuizId',
]

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  if (!text) return undefined
  return text.slice(0, maxLength)
}

function cleanUrl(value: unknown): string | undefined | null {
  const raw = cleanText(value, 2000)
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return url.toString()
  } catch {
    return null
  }
}

export function normalizeLessonContent(value: unknown): { ok: true; content: LessonContent } | { ok: false; error: string } {
  if (value == null) return { ok: true, content: {} }
  if (typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'content deve ser um objeto' }

  const source = value as Record<string, unknown>
  const externalUrl = cleanUrl(source.externalUrl)
  if (externalUrl === null) return { ok: false, error: 'externalUrl deve usar http ou https' }

  const content: LessonContent = {}
  for (const field of textFields) {
    const maxLength = field === 'body' || field === 'instructions' ? 100000 : 500
    const cleaned = cleanText(source[field], maxLength)
    if (cleaned) content[field] = cleaned
  }
  if (externalUrl) content.externalUrl = externalUrl

  return { ok: true, content }
}

export function lessonContentPublicationIssue(contentType: string, content: LessonContent): string | null {
  if (contentType === 'text') return content.body ? null : 'conteúdo textual vazio'
  if (contentType === 'link') return content.externalUrl ? null : 'link externo não informado'
  if (contentType === 'pdf' || contentType === 'presentation' || contentType === 'file') {
    return content.externalUrl ? null : 'arquivo/material ainda não possui URL autorizada'
  }
  if (contentType === 'video' || contentType === 'audio') {
    return content.providerRef || content.externalUrl ? null : 'mídia ainda não possui referência de provedor ou URL autorizada'
  }
  if (['exercise', 'practical_activity', 'case_study', 'simulation'].includes(contentType)) {
    return content.instructions || content.body ? null : 'instruções da atividade estão vazias'
  }
  if (contentType === 'quiz' || contentType === 'exam') {
    return content.linkedQuizId ? null : 'avaliação da aula ainda não possui quiz vinculado'
  }
  return null
}
