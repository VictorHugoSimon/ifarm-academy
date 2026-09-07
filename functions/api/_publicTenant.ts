import { normalizeHostname, resolveTenantBrand, type WhiteLabelBrand } from './_whiteLabel'
import type { Env } from './_shared'

export interface PublicTenantContext {
  tenantId: string
  hostname: string
  resolution: 'verified_white_label_domain' | 'configured_default_host'
  brand: WhiteLabelBrand
}

export function requestHostname(request: Request): string | null {
  const raw = new URL(request.url).hostname.trim().toLowerCase().replace(/\.$/, '')
  if (raw === 'localhost') return 'localhost'
  return normalizeHostname(raw)
}

function configuredDefaultHost(env: Env): string | null {
  const raw = String(env.ACADEMY_PUBLIC_DEFAULT_HOST ?? '').trim().toLowerCase().replace(/\.$/, '')
  if (raw === 'localhost') return 'localhost'
  return normalizeHostname(raw)
}

export async function resolvePublicTenant(db: any, env: Env, request: Request): Promise<PublicTenantContext | null> {
  const hostname = requestHostname(request)
  if (!hostname) return null

  const domain = await db.prepare(`
    SELECT tenant_id,hostname FROM academy_white_label_domains
    WHERE hostname=? AND status='verified'
    LIMIT 1
  `).bind(hostname).first()

  if (domain) {
    const tenantId = String(domain.tenant_id)
    return {
      tenantId,
      hostname,
      resolution: 'verified_white_label_domain',
      brand: await resolveTenantBrand(db, tenantId),
    }
  }

  const defaultHost = configuredDefaultHost(env)
  const defaultTenantId = String(env.ACADEMY_PUBLIC_DEFAULT_TENANT_ID ?? '').trim()
  if (defaultHost && defaultTenantId && hostname === defaultHost) {
    return {
      tenantId: defaultTenantId,
      hostname,
      resolution: 'configured_default_host',
      brand: await resolveTenantBrand(db, defaultTenantId),
    }
  }

  return null
}

export function publicCourseSlug(value: unknown): string | null {
  const slug = String(value ?? '').trim().toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) return null
  return slug
}
