export interface WhiteLabelBrand {
  brandName: string
  academyName: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  logoRef: string | null
  certificateHeading: string | null
  catalogMode: 'all_tenant_courses' | 'selected_courses'
  whiteLabelConfigured: boolean
}

export const DEFAULT_ACADEMY_BRAND: WhiteLabelBrand = {
  brandName: 'iFarm',
  academyName: 'iFarm Academy',
  primaryColor: '#004E3B',
  secondaryColor: '#087A51',
  accentColor: '#00825B',
  logoRef: null,
  certificateHeading: null,
  catalogMode: 'all_tenant_courses',
  whiteLabelConfigured: false,
}

const HEX = /^#[0-9A-Fa-f]{6}$/

export function normalizeHostname(value: string): string | null {
  const hostname = value.trim().toLowerCase().replace(/\.$/, '')
  if (!hostname || hostname.length > 253) return null
  if (hostname.includes('://') || hostname.includes('/') || hostname.includes(':')) return null
  const labels = hostname.split('.')
  if (labels.length < 2) return null
  if (labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null
  return hostname
}

export function validateBrandInput(input: {
  brandName: string
  academyName: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  logoRef?: string | null
  certificateHeading?: string | null
  catalogMode: string
}): string[] {
  const errors: string[] = []
  if (!input.brandName.trim() || input.brandName.trim().length > 80) errors.push('brandName deve ter entre 1 e 80 caracteres')
  if (!input.academyName.trim() || input.academyName.trim().length > 120) errors.push('academyName deve ter entre 1 e 120 caracteres')
  for (const [name, value] of [['primaryColor', input.primaryColor], ['secondaryColor', input.secondaryColor], ['accentColor', input.accentColor]] as const) {
    if (!HEX.test(value)) errors.push(`${name} deve usar formato #RRGGBB`)
  }
  const logoRef = input.logoRef?.trim() ?? ''
  if (logoRef && !(logoRef.startsWith('https://') || logoRef.startsWith('/'))) errors.push('logoRef deve usar HTTPS ou referência relativa da Academy')
  if ((input.certificateHeading?.trim().length ?? 0) > 160) errors.push('certificateHeading deve ter no máximo 160 caracteres')
  if (!['all_tenant_courses', 'selected_courses'].includes(input.catalogMode)) errors.push('catalogMode inválido')
  return errors
}

export function brandFromRow(row: any): WhiteLabelBrand {
  if (!row || String(row.status ?? 'inactive') !== 'active') return { ...DEFAULT_ACADEMY_BRAND }
  return {
    brandName: String(row.brand_name),
    academyName: String(row.academy_name),
    primaryColor: String(row.primary_color),
    secondaryColor: String(row.secondary_color),
    accentColor: String(row.accent_color),
    logoRef: row.logo_ref == null ? null : String(row.logo_ref),
    certificateHeading: row.certificate_heading == null ? null : String(row.certificate_heading),
    catalogMode: String(row.catalog_mode) === 'selected_courses' ? 'selected_courses' : 'all_tenant_courses',
    whiteLabelConfigured: true,
  }
}

export async function resolveTenantBrand(db: any, tenantId: string): Promise<WhiteLabelBrand> {
  const row = await db.prepare('SELECT * FROM academy_white_label_settings WHERE tenant_id=? LIMIT 1').bind(tenantId).first()
  return brandFromRow(row)
}
