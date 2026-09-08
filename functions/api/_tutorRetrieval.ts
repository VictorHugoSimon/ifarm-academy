export interface TutorEvidenceInput {
  moduleId: string
  moduleTitle: string
  lessonId: string
  lessonTitle: string
  contentType: string
  body?: string
  instructions?: string
  label?: string
}

export interface TutorCitation {
  moduleId: string
  moduleTitle: string
  lessonId: string
  lessonTitle: string
  contentType: string
  excerpt: string
}

const STOPWORDS = new Set([
  'a','o','as','os','de','da','do','das','dos','e','em','no','na','nos','nas','um','uma','uns','umas',
  'para','por','com','sem','que','qual','quais','como','quando','onde','porque','porquê','sobre','me','meu','minha',
  'se','ser','é','sao','são','ao','aos','à','às','the','and','or','of','to','in','is','are','what','how','when','where',
])

export function normalizeTutorText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tutorQueryTerms(question: string): string[] {
  return [...new Set(
    normalizeTutorText(question)
      .split(' ')
      .map((term) => term.trim())
      .filter((term) => term.length >= 3 && !STOPWORDS.has(term)),
  )]
}

function sourceText(item: TutorEvidenceInput): string {
  return [item.moduleTitle, item.lessonTitle, item.body, item.instructions, item.label]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n')
}

function scoreEvidence(item: TutorEvidenceInput, terms: string[]): number {
  if (!terms.length) return 0
  const title = normalizeTutorText(`${item.moduleTitle} ${item.lessonTitle}`)
  const body = normalizeTutorText(sourceText(item))
  let score = 0
  for (const term of terms) {
    if (title.includes(term)) score += 4
    const matches = body.split(term).length - 1
    score += Math.min(matches, 4)
  }
  return score
}

function sentenceCandidates(value: string): string[] {
  return value
    .replace(/\r/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function bestExcerpt(item: TutorEvidenceInput, terms: string[]): string {
  const text = [item.body, item.instructions, item.label]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .trim()
  if (!text) return item.lessonTitle

  const sentences = sentenceCandidates(text)
  const ranked = sentences
    .map((sentence) => ({
      sentence,
      score: terms.reduce((total, term) => total + (normalizeTutorText(sentence).includes(term) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score || a.sentence.length - b.sentence.length)
  const chosen = ranked[0]?.sentence || text
  return chosen.length > 320 ? `${chosen.slice(0, 317).trimEnd()}...` : chosen
}

export function retrieveTutorEvidence(
  question: string,
  items: TutorEvidenceInput[],
  limit = 5,
): TutorCitation[] {
  const terms = tutorQueryTerms(question)
  if (!terms.length) return []

  return items
    .map((item) => ({ item, score: scoreEvidence(item, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.lessonTitle.localeCompare(b.item.lessonTitle))
    .slice(0, Math.max(1, Math.min(limit, 8)))
    .map(({ item }) => ({
      moduleId: item.moduleId,
      moduleTitle: item.moduleTitle,
      lessonId: item.lessonId,
      lessonTitle: item.lessonTitle,
      contentType: item.contentType,
      excerpt: bestExcerpt(item, terms),
    }))
}

export function buildEvidenceOnlyTutorAnswer(citations: TutorCitation[]): string {
  if (!citations.length) {
    return 'Não encontrei conteúdo autorizado suficiente neste curso para responder com segurança. Consulte o material da disciplina ou peça orientação ao instrutor.'
  }
  const sourceLabel = citations.length === 1 ? 'uma fonte do curso' : `${citations.length} fontes do curso`
  return `Encontrei ${sourceLabel} relacionadas à sua pergunta. Nesta versão do Tutor IA, apresento somente evidências do conteúdo autorizado; consulte os trechos e aulas citados abaixo.`
}
