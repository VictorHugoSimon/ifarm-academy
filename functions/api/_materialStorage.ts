export const MAX_MATERIAL_BYTES = 100 * 1024 * 1024

const extensionMime: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
}

const allowedMimeTypes = new Set(Object.values(extensionMime))

function safeSegment(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'item'
}

export function normalizeFileName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const base = value.trim().split(/[\\/]/).pop() ?? ''
  if (!base || base === '.' || base === '..') return null
  const cleaned = safeSegment(base)
  return cleaned.includes('.') ? cleaned : null
}

export function resolveMaterialMime(fileName: string, providedMime: unknown): string | null {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
  const expected = extensionMime[extension]
  const provided = typeof providedMime === 'string' ? providedMime.trim().toLowerCase() : ''

  if (!expected) return null
  if (!provided || provided === 'application/octet-stream') return expected
  if (!allowedMimeTypes.has(provided)) return null
  return provided === expected ? provided : null
}

export function normalizeMaterialSize(value: unknown): number | null {
  const size = Number(value)
  if (!Number.isInteger(size) || size <= 0 || size > MAX_MATERIAL_BYTES) return null
  return size
}

export function buildMaterialObjectKey(input: {
  tenantId: string
  courseId: string
  lessonId: string
  assetId: string
  fileName: string
}): string {
  return [
    'academy',
    safeSegment(input.tenantId),
    safeSegment(input.courseId),
    safeSegment(input.lessonId),
    safeSegment(input.assetId),
    safeSegment(input.fileName),
  ].join('/')
}

export function materialDisposition(mimeType: string): 'inline' | 'attachment' {
  return mimeType === 'application/pdf' || mimeType.startsWith('image/') ? 'inline' : 'attachment'
}

export function storageConfigured(env: { ACADEMY_STORAGE?: unknown }): boolean {
  return Boolean(env.ACADEMY_STORAGE)
}
