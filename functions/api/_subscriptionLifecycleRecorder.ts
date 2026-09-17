import { normalizeSubscriptionLifecycleStatus } from './_subscriptionLifecycle'

export interface RecordSubscriptionLifecycleInput {
  tenantId: string
  subscriptionId: string
  checkoutSessionId: string
  webhookReceiptId?: string | null
  provider: string
  providerResourceType: string
  providerResourceId: string
  providerStatus: string
  payloadHash: string
  occurredAt?: string | null
}

export async function recordSubscriptionLifecycleEvidence(db: any, input: RecordSubscriptionLifecycleInput) {
  const normalized = normalizeSubscriptionLifecycleStatus(input.providerStatus)
  if (!normalized) throw new Error('INVALID_SUBSCRIPTION_LIFECYCLE_STATUS')
  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  await db.prepare(`INSERT OR IGNORE INTO academy_subscription_lifecycle_events
    (id,tenant_id,subscription_id,checkout_session_id,webhook_receipt_id,provider,provider_resource_type,
     provider_resource_id,provider_status,observation,payload_hash,occurred_at,observed_at,access_policy_action)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'none_policy_tbd')`).bind(
      id, input.tenantId, input.subscriptionId, input.checkoutSessionId, input.webhookReceiptId ?? null,
      input.provider.trim().toLowerCase(), input.providerResourceType, input.providerResourceId,
      normalized.providerStatus, normalized.observation, input.payloadHash,
      input.occurredAt ?? null, now,
    ).run()

  const row = await db.prepare(`SELECT * FROM academy_subscription_lifecycle_events
    WHERE tenant_id=? AND provider=? AND provider_resource_type=? AND provider_resource_id=?
      AND provider_status=? AND payload_hash=? LIMIT 1`).bind(
      input.tenantId, input.provider.trim().toLowerCase(), input.providerResourceType, input.providerResourceId,
      normalized.providerStatus, input.payloadHash,
    ).first()
  if (!row) throw new Error('SUBSCRIPTION_LIFECYCLE_PERSISTENCE_FAILED')

  return {
    id: String(row.id),
    idempotent: String(row.id) !== id,
    providerStatus: String(row.provider_status),
    observation: String(row.observation),
    accessPolicyAction: 'none_policy_tbd' as const,
    occurredAt: row.occurred_at ? String(row.occurred_at) : null,
    observedAt: String(row.observed_at),
  }
}
