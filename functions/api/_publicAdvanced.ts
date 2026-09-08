import { boundedText, publicSlug, safePublicAssetRef } from './_publicDiscovery'

export type PublicSearchType = 'course' | 'path' | 'instructor' | 'plan' | 'partner' | 'bundle'

const SEARCH_TYPES = new Set<PublicSearchType>(['course','path','instructor','plan','partner','bundle'])
const PARTNER_SOURCES = new Set(['ifarm_core','ifarm_store','ifarm_services','ifarm_finance','ifarm_insurance','marketplace','partner','other'])
const BUNDLE_ITEM_TYPES = new Set(['course','path','plan','partner','external_reference'])

export function normalizeSearchQuery(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 120)
}

export function normalizeSearchType(value: unknown): PublicSearchType | null {
  const type = String(value ?? '').trim() as PublicSearchType
  return SEARCH_TYPES.has(type) ? type : null
}

export function normalizeSearchLimit(value: unknown): number {
  const parsed = Number(value ?? 24)
  if (!Number.isFinite(parsed)) return 24
  return Math.max(1, Math.min(50, Math.trunc(parsed)))
}

export function publicSearchScore(query: string, title: string, description = '', category = ''): number {
  const needle = query.toLocaleLowerCase('pt-BR')
  if (!needle) return 1
  const t = title.toLocaleLowerCase('pt-BR')
  const d = description.toLocaleLowerCase('pt-BR')
  const c = category.toLocaleLowerCase('pt-BR')
  if (t === needle) return 100
  if (t.startsWith(needle)) return 80
  if (t.includes(needle)) return 60
  if (c === needle) return 45
  if (c.includes(needle)) return 35
  if (d.includes(needle)) return 20
  return 0
}

export function safePublicWebsite(value: unknown): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  if (text.length > 1200) return null
  try {
    const url = new URL(text)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function validatePublicPartnerInput(body: Record<string, unknown>) {
  const slug = publicSlug(body.slug)
  const sourceSystem = String(body.sourceSystem ?? '').trim()
  const sourceRef = boundedText(body.sourceRef, 160)
  const displayName = boundedText(body.displayName, 160)
  const visibility = body.visibility === 'public' ? 'public' : 'hidden'
  const websiteUrl = body.websiteUrl == null || body.websiteUrl === '' ? null : safePublicWebsite(body.websiteUrl)
  if (!slug || !PARTNER_SOURCES.has(sourceSystem) || !sourceRef || !displayName) return null
  if (body.websiteUrl && !websiteUrl) return null
  return {
    slug,
    sourceSystem,
    sourceRef,
    displayName,
    shortDescription: boundedText(body.shortDescription, 280),
    description: boundedText(body.description, 5000) ?? '',
    logoRef: safePublicAssetRef(body.logoRef),
    websiteUrl,
    visibility,
    featured: body.featured === true || body.featured === 1 ? 1 : 0,
    seoTitle: boundedText(body.seoTitle, 180),
    seoDescription: boundedText(body.seoDescription, 320),
  }
}

export function validatePublicBundleInput(body: Record<string, unknown>) {
  const slug = publicSlug(body.slug)
  const title = boundedText(body.title, 180)
  const visibility = body.visibility === 'public' ? 'public' : 'hidden'
  if (!slug || !title) return null
  const rawItems = Array.isArray(body.items) ? body.items : []
  const items: Array<{ itemType: string; itemRef: string; sourceSystem: string | null; label: string | null; description: string; position: number }> = []
  for (let index = 0; index < rawItems.length && index < 60; index += 1) {
    const item = rawItems[index]
    if (!item || typeof item !== 'object') return null
    const row = item as Record<string, unknown>
    const itemType = String(row.itemType ?? '').trim()
    const itemRef = boundedText(row.itemRef, 180)
    if (!BUNDLE_ITEM_TYPES.has(itemType) || !itemRef) return null
    const sourceSystem = itemType === 'external_reference' ? boundedText(row.sourceSystem, 80) : null
    const label = itemType === 'external_reference' ? boundedText(row.label, 180) : null
    if (itemType === 'external_reference' && (!sourceSystem || !label)) return null
    items.push({
      itemType,
      itemRef,
      sourceSystem,
      label,
      description: boundedText(row.description, 500) ?? '',
      position: index,
    })
  }
  if (visibility === 'public' && items.length === 0) return null
  return {
    slug,
    title,
    shortDescription: boundedText(body.shortDescription, 280),
    description: boundedText(body.description, 5000) ?? '',
    coverRef: safePublicAssetRef(body.coverRef),
    category: boundedText(body.category, 120),
    visibility,
    featured: body.featured === true || body.featured === 1 ? 1 : 0,
    seoTitle: boundedText(body.seoTitle, 180),
    seoDescription: boundedText(body.seoDescription, 320),
    items,
  }
}
