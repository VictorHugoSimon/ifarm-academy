export const PUBLIC_SEARCH_TYPES = ['course', 'path', 'instructor', 'event', 'plan'] as const
export type PublicSearchType = typeof PUBLIC_SEARCH_TYPES[number]

export interface PublicSearchCandidate {
  type: PublicSearchType
  id: string
  slug?: string | null
  title: string
  description: string
  category?: string | null
  level?: string | null
  accessModel?: string | null
  modality?: string | null
  startsAt?: string | null
  imageRef?: string | null
  featured: boolean
  href: string
  meta?: string[]
  searchText?: string
}

export interface PublicSearchFilters {
  query: string
  types: PublicSearchType[]
  category: string
  access: string
  level: string
  modality: string
  limit: number
  offset: number
}

export interface PublicSearchFacets {
  types: Record<PublicSearchType, number>
  categories: Array<{ value: string; count: number }>
  accessModels: Array<{ value: string; count: number }>
  levels: Array<{ value: string; count: number }>
  modalities: Array<{ value: string; count: number }>
}

function safeParam(value: string | null, max: number): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
}

function positiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(max, Math.trunc(parsed))
}

export function normalizePublicSearchText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parsePublicSearchFilters(url: URL): PublicSearchFilters {
  const typeSet = new Set<PublicSearchType>()
  const rawTypes = safeParam(url.searchParams.get('types'), 120)
  for (const raw of rawTypes.split(',')) {
    const type = raw.trim() as PublicSearchType
    if ((PUBLIC_SEARCH_TYPES as readonly string[]).includes(type)) typeSet.add(type)
  }

  return {
    query: safeParam(url.searchParams.get('q'), 120),
    types: typeSet.size ? [...typeSet] : [...PUBLIC_SEARCH_TYPES],
    category: safeParam(url.searchParams.get('category'), 80),
    access: safeParam(url.searchParams.get('access'), 40),
    level: safeParam(url.searchParams.get('level'), 80),
    modality: safeParam(url.searchParams.get('modality'), 40),
    limit: Math.max(1, positiveInt(url.searchParams.get('limit'), 24, 48)),
    offset: positiveInt(url.searchParams.get('offset'), 0, 5000),
  }
}

function textMatchScore(candidate: PublicSearchCandidate, query: string): number {
  const q = normalizePublicSearchText(query)
  if (!q) return candidate.featured ? 20 : 0

  const title = normalizePublicSearchText(candidate.title)
  const description = normalizePublicSearchText(candidate.description)
  const searchText = normalizePublicSearchText([
    candidate.title,
    candidate.description,
    candidate.category,
    candidate.level,
    candidate.accessModel,
    candidate.modality,
    ...(candidate.meta ?? []),
    candidate.searchText,
  ].filter(Boolean).join(' '))

  let score = candidate.featured ? 8 : 0
  if (title === q) score += 120
  else if (title.startsWith(q)) score += 95
  else if (title.includes(q)) score += 75

  if (description.includes(q)) score += 35
  if (searchText.includes(q)) score += 25

  const tokens = [...new Set(q.split(' ').filter((token) => token.length >= 2))].slice(0, 8)
  for (const token of tokens) {
    if (title.includes(token)) score += 14
    if (description.includes(token)) score += 6
    if (searchText.includes(token)) score += 4
  }
  return score
}

function matchesQuery(candidate: PublicSearchCandidate, query: string): boolean {
  const q = normalizePublicSearchText(query)
  if (!q) return true
  const text = normalizePublicSearchText([
    candidate.title,
    candidate.description,
    candidate.category,
    candidate.level,
    candidate.accessModel,
    candidate.modality,
    ...(candidate.meta ?? []),
    candidate.searchText,
  ].filter(Boolean).join(' '))
  return q.split(' ').filter(Boolean).every((token) => text.includes(token))
}

function matchesDimension(value: string | null | undefined, filter: string): boolean {
  if (!filter) return true
  return normalizePublicSearchText(value ?? '') === normalizePublicSearchText(filter)
}

function countFacet(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>()
  for (const value of values) {
    const clean = (value ?? '').trim()
    if (!clean) continue
    counts.set(clean, (counts.get(clean) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'pt-BR'))
}

export function searchPublicCandidates(candidates: PublicSearchCandidate[], filters: PublicSearchFilters) {
  const queryMatched = candidates.filter((candidate) => matchesQuery(candidate, filters.query))

  const facets: PublicSearchFacets = {
    types: { course: 0, path: 0, instructor: 0, event: 0, plan: 0 },
    categories: countFacet(queryMatched.map((item) => item.category)),
    accessModels: countFacet(queryMatched.map((item) => item.accessModel)),
    levels: countFacet(queryMatched.map((item) => item.level)),
    modalities: countFacet(queryMatched.map((item) => item.modality)),
  }
  for (const item of queryMatched) facets.types[item.type] += 1

  const allowedTypes = new Set(filters.types)
  const filtered = queryMatched.filter((candidate) =>
    allowedTypes.has(candidate.type)
    && matchesDimension(candidate.category, filters.category)
    && matchesDimension(candidate.accessModel, filters.access)
    && matchesDimension(candidate.level, filters.level)
    && matchesDimension(candidate.modality, filters.modality),
  )

  const ranked = filtered
    .map((candidate) => ({ candidate, score: textMatchScore(candidate, filters.query) }))
    .sort((a, b) =>
      b.score - a.score
      || Number(b.candidate.featured) - Number(a.candidate.featured)
      || a.candidate.title.localeCompare(b.candidate.title, 'pt-BR')
      || a.candidate.type.localeCompare(b.candidate.type)
      || a.candidate.id.localeCompare(b.candidate.id),
    )

  const total = ranked.length
  const page = ranked.slice(filters.offset, filters.offset + filters.limit).map(({ candidate }) => candidate)
  return {
    items: page,
    total,
    facets,
    pagination: {
      limit: filters.limit,
      offset: filters.offset,
      hasMore: filters.offset + page.length < total,
    },
  }
}
