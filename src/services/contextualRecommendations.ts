import { loadPublicSearch, type PublicSearchItem, type PublicSearchType } from './publicPortalApi'

export interface ContextualRecommendationInput {
  currentHref: string
  query?: string | null
  category?: string | null
  types?: PublicSearchType[]
  limit?: number
}

export interface ContextualRecommendationResult {
  items: PublicSearchItem[]
  policy: {
    source: 'current_content_context'
    behavioralPersonalization: false
    commercialProfiling: false
    storesVisitorHistory: false
  }
}

export function filterContextualRecommendations(items: PublicSearchItem[], currentHref: string, limit = 4) {
  const safeLimit = Math.max(1, Math.min(8, Math.trunc(limit || 4)))
  const seen = new Set<string>()
  const result: PublicSearchItem[] = []
  for (const item of items) {
    if (item.href === currentHref) continue
    const key = `${item.type}:${item.id}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
    if (result.length >= safeLimit) break
  }
  return result
}

export async function loadContextualRecommendations(input: ContextualRecommendationInput): Promise<ContextualRecommendationResult> {
  const limit = Math.max(1, Math.min(8, Math.trunc(input.limit ?? 4)))
  const category = input.category?.trim() || ''
  const query = category ? '' : input.query?.trim() || ''
  if (!category && !query) {
    return { items: [], policy: { source:'current_content_context', behavioralPersonalization:false, commercialProfiling:false, storesVisitorHistory:false } }
  }
  const response = await loadPublicSearch({
    q: query,
    category,
    types: input.types,
    limit: Math.min(48, limit + 8),
    offset: 0,
  })
  return {
    items: filterContextualRecommendations(response.data, input.currentHref, limit),
    policy: { source:'current_content_context', behavioralPersonalization:false, commercialProfiling:false, storesVisitorHistory:false },
  }
}
