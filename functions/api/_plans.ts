export type PlanAudience = 'individual'|'corporate'|'partner'
export type PlanCommercialMode = 'free'|'priced'|'contact_sales'
export type PlanBillingInterval = 'monthly'|'annual'
export type PlanPriceUnit = 'subscription'|'per_user'

export function planSlug(value: unknown): string | null {
  const slug = String(value ?? '').trim().toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) return null
  return slug
}

export function planAudience(value: unknown): PlanAudience | null {
  const normalized = String(value ?? '').trim()
  return normalized === 'individual' || normalized === 'corporate' || normalized === 'partner' ? normalized : null
}

export function planCommercialMode(value: unknown): PlanCommercialMode | null {
  const normalized = String(value ?? '').trim()
  return normalized === 'free' || normalized === 'priced' || normalized === 'contact_sales' ? normalized : null
}

export function normalizePlanPrice(input: { amountCents?: unknown; billingInterval?: unknown; priceUnit?: unknown }) {
  const amountCents = Number(input.amountCents)
  const billingInterval = String(input.billingInterval ?? '').trim()
  const priceUnit = String(input.priceUnit ?? '').trim()
  if (!Number.isInteger(amountCents) || amountCents < 1) return null
  if (billingInterval !== 'monthly' && billingInterval !== 'annual') return null
  if (priceUnit !== 'subscription' && priceUnit !== 'per_user') return null
  return { amountCents, billingInterval: billingInterval as PlanBillingInterval, priceUnit: priceUnit as PlanPriceUnit }
}

export function normalizeExternalBenefits(value: unknown): Array<{ sourceSystem: string; externalRef: string; label: string; description: string }> {
  if (!Array.isArray(value)) return []
  const allowed = new Set(['ifarm_core','ifarm_store','ifarm_services','ifarm_finance','ifarm_insurance','partner','other'])
  const seen = new Set<string>()
  const output: Array<{ sourceSystem: string; externalRef: string; label: string; description: string }> = []
  for (const raw of value.slice(0, 30)) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Record<string, unknown>
    const sourceSystem = String(item.sourceSystem ?? '').trim()
    const externalRef = String(item.externalRef ?? '').trim().slice(0, 240)
    const label = String(item.label ?? '').trim().slice(0, 160)
    const description = String(item.description ?? '').trim().slice(0, 500)
    if (!allowed.has(sourceSystem) || !externalRef || !label) continue
    const key = `${sourceSystem}:${externalRef}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push({ sourceSystem, externalRef, label, description })
  }
  return output
}

export function validatePlanCommercialShape(input: { audienceType: PlanAudience; commercialMode: PlanCommercialMode; maxUsers?: number | null }) {
  const maxUsers = input.maxUsers == null ? null : Number(input.maxUsers)
  if (maxUsers != null && (!Number.isInteger(maxUsers) || maxUsers < 1)) return 'maxUsers inválido'
  if (input.audienceType !== 'corporate' && maxUsers != null) return 'maxUsers só é permitido em plano corporativo'
  return null
}
