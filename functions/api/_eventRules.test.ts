import { describe, expect, it } from 'vitest'
import { decideEventRegistration } from './_eventRules'

const now = new Date('2026-09-02T12:00:00.000Z')
const base = {
  status: 'published',
  accessModel: 'free',
  endsAt: '2026-09-03T18:00:00.000Z',
  registrationDeadline: '2026-09-03T10:00:00.000Z',
  capacity: 10,
  occupied: 2,
  now,
}

describe('event registration rules', () => {
  it('registers when a free published event has capacity', () => {
    expect(decideEventRegistration(base)).toEqual({ allowed: true, status: 'registered' })
  })

  it('waitlists when capacity is full', () => {
    expect(decideEventRegistration({ ...base, occupied: 10 })).toEqual({ allowed: true, status: 'waitlisted' })
  })

  it('requires checkout for paid events', () => {
    expect(decideEventRegistration({ ...base, accessModel: 'paid' })).toEqual({ allowed: false, reason: 'checkout_required' })
  })

  it('blocks after registration deadline', () => {
    expect(decideEventRegistration({ ...base, registrationDeadline: '2026-09-01T10:00:00.000Z' }))
      .toEqual({ allowed: false, reason: 'registration_closed' })
  })

  it('blocks events that are not published or already ended', () => {
    expect(decideEventRegistration({ ...base, status: 'draft' })).toEqual({ allowed: false, reason: 'not_published' })
    expect(decideEventRegistration({ ...base, endsAt: '2026-09-01T18:00:00.000Z' })).toEqual({ allowed: false, reason: 'event_ended' })
  })
})
