import { publicCourseSlug } from './_publicTenant'

export const publicSlug = publicCourseSlug

export function safePublicAssetRef(value: unknown): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  if (text.length > 800) return null
  if (text.startsWith('/')) return text.startsWith('//') ? null : text
  try {
    const url = new URL(text)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function normalizePublicTextList(value: unknown, maxItems = 12): string[] {
  const source = Array.isArray(value) ? value : []
  const output: string[] = []
  for (const item of source) {
    const text = String(item ?? '').trim().replace(/\s+/g, ' ')
    if (!text || text.length > 80) continue
    if (!output.some((existing) => existing.toLocaleLowerCase('pt-BR') === text.toLocaleLowerCase('pt-BR'))) output.push(text)
    if (output.length >= maxItems) break
  }
  return output
}

export function boundedText(value: unknown, max: number): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  return text.length <= max ? text : null
}
