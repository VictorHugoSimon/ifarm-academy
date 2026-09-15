export type TutorSourceType = 'lesson_body' | 'lesson_instructions'

export interface TutorChunkDraft {
  sourceType: TutorSourceType
  text: string
  chunkIndex: number
}

export interface TutorEvidence {
  id: string
  courseId: string
  lessonId: string
  sourceTitle: string
  sourceType: TutorSourceType
  text: string
  score: number
}

const STOPWORDS = new Set([
  'a','ao','aos','as','com','como','da','das','de','do','dos','e','em','na','nas','no','nos',
  'o','os','ou','para','por','que','se','um','uma','uns','umas','the','and','for','with','from',
])

function cleanText(value: unknown, max = 50_000): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

export function extractTutorText(content: unknown): Array<{ sourceType: TutorSourceType; text: string }> {
  if (!content || typeof content !== 'object') return []
  const raw = content as Record<string, unknown>
  const output: Array<{ sourceType: TutorSourceType; text: string }> = []
  const body = cleanText(raw.body)
  const instructions = cleanText(raw.instructions)
  if (body) output.push({ sourceType: 'lesson_body', text: body })
  if (instructions) output.push({ sourceType: 'lesson_instructions', text: instructions })
  return output
}

export function splitTutorText(text: string, maxChars = 1200): string[] {
  const normalized = cleanText(text)
  if (!normalized) return []
  const limit = Math.min(2000, Math.max(300, Math.trunc(maxChars)))
  const chunks: string[] = []
  let remaining = normalized
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf('. ', limit)
    if (cut < Math.floor(limit * 0.55)) cut = remaining.lastIndexOf(' ', limit)
    if (cut < Math.floor(limit * 0.4)) cut = limit
    const chunk = remaining.slice(0, cut + (remaining[cut] === '.' ? 1 : 0)).trim()
    if (chunk) chunks.push(chunk)
    remaining = remaining.slice(cut + (remaining[cut] === '.' ? 1 : 0)).trim()
  }
  if (remaining) chunks.push(remaining)
  return chunks
}

export function buildTutorChunks(content: unknown): TutorChunkDraft[] {
  const result: TutorChunkDraft[] = []
  for (const source of extractTutorText(content)) {
    splitTutorText(source.text).forEach((text, chunkIndex) => {
      result.push({ sourceType: source.sourceType, text, chunkIndex })
    })
  }
  return result
}

export function tutorQueryTokens(query: string): string[] {
  return [...new Set(
    query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !STOPWORDS.has(token)),
  )].slice(0, 24)
}

export function scoreTutorEvidence(query: string, rows: Omit<TutorEvidence, 'score'>[]): TutorEvidence[] {
  const tokens = tutorQueryTokens(query)
  if (!tokens.length) return []
  return rows
    .map((row) => {
      const haystack = `${row.sourceTitle} ${row.text}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
      let score = 0
      for (const token of tokens) {
        if (haystack.includes(token)) score += row.sourceTitle.toLowerCase().includes(token) ? 3 : 1
      }
      return { ...row, score }
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.sourceTitle.localeCompare(b.sourceTitle))
}

export function evidenceOnlyMessage(evidence: TutorEvidence[]): { mode: 'evidence_only' | 'insufficient_context'; text: string } {
  if (!evidence.length) {
    return {
      mode: 'insufficient_context',
      text: 'Não encontrei conteúdo autorizado suficiente neste curso para responder com segurança. Consulte o material da aula ou envie uma pergunta mais específica.',
    }
  }
  return {
    mode: 'evidence_only',
    text: 'Encontrei evidências no conteúdo autorizado do curso. Nesta versão do Tutor, apresento apenas as fontes relevantes sem gerar afirmações técnicas além do material publicado.',
  }
}
