export interface EventRegistrationPolicyInput {
  status: string
  accessModel: string
  endsAt: string
  registrationDeadline?: string | null
  capacity?: number | null
  occupied: number
  now?: Date
}

export type EventRegistrationDecision =
  | { allowed: true; status: 'registered' | 'waitlisted' }
  | { allowed: false; reason: 'not_published' | 'checkout_required' | 'event_ended' | 'registration_closed' }

export function decideEventRegistration(input: EventRegistrationPolicyInput): EventRegistrationDecision {
  if (input.status !== 'published') return { allowed: false, reason: 'not_published' }
  if (input.accessModel === 'paid') return { allowed: false, reason: 'checkout_required' }

  const now = input.now ?? new Date()
  const endsAt = new Date(input.endsAt)
  if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= now.getTime()) {
    return { allowed: false, reason: 'event_ended' }
  }

  if (input.registrationDeadline) {
    const deadline = new Date(input.registrationDeadline)
    if (!Number.isNaN(deadline.getTime()) && deadline.getTime() < now.getTime()) {
      return { allowed: false, reason: 'registration_closed' }
    }
  }

  const capacity = input.capacity == null ? null : Number(input.capacity)
  if (capacity != null && Number.isFinite(capacity) && input.occupied >= capacity) {
    return { allowed: true, status: 'waitlisted' }
  }
  return { allowed: true, status: 'registered' }
}
