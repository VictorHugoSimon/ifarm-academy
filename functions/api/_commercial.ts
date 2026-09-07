export const COMMERCIAL_SOURCE_TYPES = ['course_completion','certificate_issued','event','learning_path','plan'] as const
export const COMMERCIAL_OFFER_SYSTEMS = ['ifarm_core','ifarm_store','ifarm_services','ifarm_finance','ifarm_insurance','academy','partner','other'] as const
export const COMMERCIAL_STAGES = ['new','qualified','contacted','opportunity','converted','discarded'] as const

export type CommercialSourceType = typeof COMMERCIAL_SOURCE_TYPES[number]
export type CommercialOfferSystem = typeof COMMERCIAL_OFFER_SYSTEMS[number]
export type CommercialStage = typeof COMMERCIAL_STAGES[number]

export const SMART_FARM_CONSENT = {
  source: 'explicit_event_interest',
  purpose: 'Registrar interesse comercial voluntário e permitir contato da iFarm sobre a solução selecionada.',
  text: 'Autorizo a iFarm a registrar meu interesse no tema selecionado e entrar em contato sobre esta oportunidade comercial.',
  version: 'smart-farm-interest-v2',
} as const

export function isCommercialSourceType(value: unknown): value is CommercialSourceType {
  return (COMMERCIAL_SOURCE_TYPES as readonly unknown[]).includes(value)
}

export function isCommercialOfferSystem(value: unknown): value is CommercialOfferSystem {
  return (COMMERCIAL_OFFER_SYSTEMS as readonly unknown[]).includes(value)
}

export function isCommercialStage(value: unknown): value is CommercialStage {
  return (COMMERCIAL_STAGES as readonly unknown[]).includes(value)
}

export function commercialToken(value: unknown, max = 120): string | null {
  const token = String(value ?? '').trim().toLowerCase()
  if (!token || token.length > max || !/^[a-z0-9][a-z0-9_.:-]*$/.test(token)) return null
  return token
}

export function commercialConsentSnapshot(input: { purpose: unknown; text: unknown; version: unknown }) {
  const purpose = String(input.purpose ?? '').trim()
  const text = String(input.text ?? '').trim()
  const version = String(input.version ?? '').trim()
  if (!purpose || purpose.length > 500) return null
  if (!text || text.length > 1200) return null
  if (!version || version.length > 120) return null
  return { purpose, text, version }
}

export function normalizePipelineUpdate(input: { stage: unknown; conversionRef?: unknown }) {
  const stage = String(input.stage ?? '').trim()
  if (!isCommercialStage(stage)) return null
  const conversionRef = String(input.conversionRef ?? '').trim() || null
  if (stage === 'converted' && !conversionRef) return null
  return { stage, conversionRef }
}

export async function verifyCommercialSourceEligibility(
  db: any,
  tenantId: string,
  userId: string,
  sourceType: CommercialSourceType,
  sourceRef: string,
): Promise<{ eligible: true; sourceInstanceRef: string | null; companyId: string | null } | { eligible: false; reason: string }> {
  if (sourceType === 'course_completion') {
    const enrollment = await db.prepare(`SELECT id FROM academy_enrollments WHERE tenant_id=? AND course_id=? AND student_id=? AND status='completed' LIMIT 1`)
      .bind(tenantId, sourceRef, userId).first()
    return enrollment ? { eligible: true, sourceInstanceRef: String(enrollment.id), companyId: null } : { eligible: false, reason: 'Curso ainda não foi concluído por este usuário' }
  }

  if (sourceType === 'certificate_issued') {
    const certificate = await db.prepare(`SELECT id FROM academy_certificates WHERE tenant_id=? AND course_id=? AND student_id=? AND status='valid' LIMIT 1`)
      .bind(tenantId, sourceRef, userId).first()
    return certificate ? { eligible: true, sourceInstanceRef: String(certificate.id), companyId: null } : { eligible: false, reason: 'Certificado válido não encontrado para este usuário/curso' }
  }

  if (sourceType === 'event') {
    const registration = await db.prepare(`SELECT id,company_id,status FROM academy_event_registrations WHERE tenant_id=? AND event_id=? AND user_id=? LIMIT 1`)
      .bind(tenantId, sourceRef, userId).first()
    if (!registration || !['registered','attended'].includes(String(registration.status))) return { eligible: false, reason: 'Inscrição elegível no evento não encontrada' }
    return { eligible: true, sourceInstanceRef: String(registration.id), companyId: registration.company_id ? String(registration.company_id) : null }
  }

  if (sourceType === 'learning_path') {
    const path = await db.prepare(`SELECT id FROM academy_public_learning_paths WHERE tenant_id=? AND id=? AND visibility='public' LIMIT 1`)
      .bind(tenantId, sourceRef).first()
    return path ? { eligible: true, sourceInstanceRef: null, companyId: null } : { eligible: false, reason: 'Trilha pública não encontrada neste tenant' }
  }

  const plan = await db.prepare(`SELECT id FROM academy_plans WHERE tenant_id=? AND id=? AND status='public' LIMIT 1`)
    .bind(tenantId, sourceRef).first()
  return plan ? { eligible: true, sourceInstanceRef: null, companyId: null } : { eligible: false, reason: 'Plano público não encontrado neste tenant' }
}
