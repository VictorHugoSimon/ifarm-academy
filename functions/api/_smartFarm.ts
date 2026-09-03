export const SMART_FARM_INTEREST_CODES = [
  'irrigation',
  'iot',
  'weather_station',
  'lorawan',
  'drones',
  'precision_agriculture',
  'insurance',
  'credit',
  'technical_services',
  'ifarm_store',
  'other',
] as const

export type SmartFarmInterestCode = typeof SMART_FARM_INTEREST_CODES[number]
export type SmartFarmTokenPurpose = 'checkin' | 'checkout' | 'station'

export function isInterestCode(value: string): value is SmartFarmInterestCode {
  return (SMART_FARM_INTEREST_CODES as readonly string[]).includes(value)
}

export async function hashEventToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token.trim())
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, '0')).join('')
}

export function createEventToken(): string {
  return `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`
}

export function validateTokenWindow(
  eventStart: string,
  eventEnd: string,
  validFrom: string,
  validUntil: string,
): string | null {
  const start = new Date(eventStart).getTime()
  const end = new Date(eventEnd).getTime()
  const from = new Date(validFrom).getTime()
  const until = new Date(validUntil).getTime()
  if (![start, end, from, until].every(Number.isFinite)) return 'Janela temporal inválida'
  if (until <= from) return 'validUntil deve ser posterior a validFrom'
  const tolerance = 24 * 60 * 60 * 1000
  if (from < start - tolerance || until > end + tolerance) {
    return 'Token QR deve ficar limitado ao intervalo do evento com tolerância máxima de 24 horas'
  }
  return null
}

export function tokenIsUsable(
  token: { active: number; valid_from: string; valid_until: string; use_count?: number; max_uses?: number | null },
  now = new Date(),
): boolean {
  if (Number(token.active) !== 1) return false
  const current = now.getTime()
  const from = new Date(token.valid_from).getTime()
  const until = new Date(token.valid_until).getTime()
  if (!Number.isFinite(from) || !Number.isFinite(until) || current < from || current > until) return false
  if (token.max_uses != null && Number(token.use_count ?? 0) >= Number(token.max_uses)) return false
  return true
}
