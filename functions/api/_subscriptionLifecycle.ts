export type SubscriptionProviderObservation =
  | 'provider_authorized'
  | 'provider_pending'
  | 'provider_paused'
  | 'provider_cancelled'
  | 'provider_unknown'

export interface SubscriptionLifecycleObservation {
  providerStatus: string
  observation: SubscriptionProviderObservation
  accessPolicyAction: 'none_policy_tbd'
}

export function normalizeSubscriptionLifecycleStatus(value: unknown): SubscriptionLifecycleObservation | null {
  if (typeof value !== 'string') return null
  const providerStatus = value.trim().toLowerCase()
  if (!providerStatus || providerStatus.length > 80 || !/^[a-z0-9_-]+$/.test(providerStatus)) return null
  let observation: SubscriptionProviderObservation = 'provider_unknown'
  if (providerStatus === 'authorized') observation = 'provider_authorized'
  else if (providerStatus === 'pending') observation = 'provider_pending'
  else if (providerStatus === 'paused') observation = 'provider_paused'
  else if (providerStatus === 'cancelled' || providerStatus === 'canceled') observation = 'provider_cancelled'
  return { providerStatus, observation, accessPolicyAction: 'none_policy_tbd' }
}

export function lifecycleEventKey(input: {
  provider: string
  resourceType: string
  resourceId: string
  providerStatus: string
  payloadHash: string
}): string {
  return [input.provider.trim().toLowerCase(), input.resourceType, input.resourceId, input.providerStatus, input.payloadHash].join('|')
}
