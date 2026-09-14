export interface MercadoPagoSignatureParts {
  ts: string
  v1: string
}

const HEX64 = /^[a-f0-9]{64}$/i

export function parseMercadoPagoSignature(value: string | null): MercadoPagoSignatureParts | null {
  if (!value) return null
  let ts = ''
  let v1 = ''
  for (const part of value.split(',')) {
    const [rawKey, ...rest] = part.split('=')
    const key = rawKey?.trim().toLowerCase()
    const candidate = rest.join('=').trim()
    if (key === 'ts') ts = candidate
    else if (key === 'v1') v1 = candidate.toLowerCase()
  }
  if (!/^\d{1,20}$/.test(ts) || !HEX64.test(v1)) return null
  return { ts, v1 }
}

export function normalizeMercadoPagoDataId(value: string | null): string | null {
  const dataId = value?.trim() ?? ''
  if (!dataId || dataId.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(dataId)) return null
  return dataId.toLowerCase()
}

export function mercadoPagoSignatureManifest(input: { dataId: string; requestId: string; ts: string }): string {
  return `id:${input.dataId.toLowerCase()};request-id:${input.requestId};ts:${input.ts};`
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return bytesToHex(new Uint8Array(signature))
}

function constantTimeHexEqual(left: string, right: string): boolean {
  const a = left.toLowerCase()
  const b = right.toLowerCase()
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return diff === 0
}

export async function verifyMercadoPagoWebhookSignature(input: {
  xSignature: string | null
  xRequestId: string | null
  dataId: string | null
  secret: string
}): Promise<{ valid: boolean; ts?: string; manifest?: string; reason?: string }> {
  const parts = parseMercadoPagoSignature(input.xSignature)
  if (!parts) return { valid: false, reason: 'invalid_signature_header' }
  const requestId = input.xRequestId?.trim() ?? ''
  if (!requestId || requestId.length > 200) return { valid: false, reason: 'missing_request_id' }
  const dataId = normalizeMercadoPagoDataId(input.dataId)
  if (!dataId) return { valid: false, reason: 'invalid_data_id' }
  if (!input.secret.trim()) return { valid: false, reason: 'missing_secret' }

  const manifest = mercadoPagoSignatureManifest({ dataId, requestId, ts: parts.ts })
  const expected = await hmacSha256Hex(input.secret, manifest)
  return constantTimeHexEqual(expected, parts.v1)
    ? { valid: true, ts: parts.ts, manifest }
    : { valid: false, ts: parts.ts, manifest, reason: 'signature_mismatch' }
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToHex(new Uint8Array(digest))
}

const SUPPORTED_TYPES = new Set([
  'payment',
  'subscription_preapproval',
  'subscription_preapproval_plan',
  'subscription_authorized_payment',
])

export function classifyMercadoPagoNotificationType(type: unknown): 'supported' | 'ignored' {
  const value = typeof type === 'string' ? type.trim().toLowerCase() : ''
  return SUPPORTED_TYPES.has(value) ? 'supported' : 'ignored'
}
