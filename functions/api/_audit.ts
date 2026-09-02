import type { AdminContext, TrustedContext } from './_auth'

export interface AuditEventInput {
  action: string
  resourceType: string
  resourceId?: string | null
  metadata?: Record<string, unknown>
}

export function auditStatement(
  db: any,
  context: TrustedContext | AdminContext,
  input: AuditEventInput,
) {
  return db.prepare(`
    INSERT INTO academy_audit_events (
      id, tenant_id, actor_id, actor_roles_json, action,
      resource_type, resource_id, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    context.tenantId,
    context.userId,
    JSON.stringify(context.roles),
    input.action,
    input.resourceType,
    input.resourceId ?? null,
    JSON.stringify(input.metadata ?? {}),
    new Date().toISOString(),
  )
}
