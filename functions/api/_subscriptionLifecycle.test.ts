import { describe, expect, it } from 'vitest'
import { lifecycleEventKey, normalizeSubscriptionLifecycleStatus } from './_subscriptionLifecycle'

describe('subscription lifecycle evidence', () => {
  it('keeps provider status as an observation without enforcing access policy', () => {
    expect(normalizeSubscriptionLifecycleStatus('authorized')).toEqual({
      providerStatus: 'authorized', observation: 'provider_authorized', accessPolicyAction: 'none_policy_tbd',
    })
    expect(normalizeSubscriptionLifecycleStatus('paused')).toMatchObject({ observation: 'provider_paused', accessPolicyAction: 'none_policy_tbd' })
    expect(normalizeSubscriptionLifecycleStatus('cancelled')).toMatchObject({ observation: 'provider_cancelled', accessPolicyAction: 'none_policy_tbd' })
  })

  it('preserves an unknown provider state without inventing local semantics', () => {
    expect(normalizeSubscriptionLifecycleStatus('mystery_state')).toEqual({
      providerStatus: 'mystery_state', observation: 'provider_unknown', accessPolicyAction: 'none_policy_tbd',
    })
  })

  it('rejects empty or unsafe provider statuses', () => {
    expect(normalizeSubscriptionLifecycleStatus('')).toBeNull()
    expect(normalizeSubscriptionLifecycleStatus('authorized<script>')).toBeNull()
    expect(normalizeSubscriptionLifecycleStatus(null)).toBeNull()
  })

  it('builds deterministic idempotency material from canonical evidence only', () => {
    expect(lifecycleEventKey({
      provider: ' Mercado_Pago ', resourceType: 'preapproval', resourceId: 'sub-1',
      providerStatus: 'paused', payloadHash: 'a'.repeat(64),
    })).toBe(`mercado_pago|preapproval|sub-1|paused|${'a'.repeat(64)}`)
  })
})
