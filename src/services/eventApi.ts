export type AcademyEventType = 'workshop' | 'field_day' | 'practical_class' | 'training' | 'webinar' | 'other'
export type AcademyEventModality = 'in_person' | 'online' | 'hybrid'
export type AcademyEventAccessModel = 'free' | 'paid' | 'sponsored'
export type AcademyEventStatus = 'draft' | 'published' | 'completed' | 'cancelled'
export type EventRegistrationStatus = 'registered' | 'waitlisted' | 'cancelled' | 'attended' | 'no_show'

export interface AcademyEventRecord {
  id: string
  title: string
  description: string
  eventType: AcademyEventType
  modality: AcademyEventModality
  status: AcademyEventStatus
  accessModel: AcademyEventAccessModel
  priceCents?: number | null
  currency: string
  startsAt: string
  endsAt: string
  timezone: string
  registrationDeadline?: string | null
  capacity?: number | null
  venueName?: string | null
  addressText?: string | null
  meetingUrl?: string | null
  smartFarmExperience: boolean
  occupied?: number
  waitlisted?: number
  attended?: number
  publishedAt?: string | null
  completedAt?: string | null
  createdAt?: string
  updatedAt?: string
  myRegistrationId?: string | null
  myRegistrationStatus?: EventRegistrationStatus | null
}

export interface EventRegistrationRecord {
  id: string
  eventId: string
  title?: string
  eventType?: AcademyEventType
  modality?: AcademyEventModality
  accessModel?: AcademyEventAccessModel
  startsAt?: string
  endsAt?: string
  venueName?: string | null
  addressText?: string | null
  meetingUrl?: string | null
  smartFarmExperience?: boolean
  userId?: string
  displayName?: string
  companyId?: string | null
  status: EventRegistrationStatus
  marketingConsent?: boolean
  registeredAt: string
  checkinAt?: string | null
  checkoutAt?: string | null
  evidenceCount?: number
  lastEvidenceAt?: string | null
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`Academy API ${response.status}: ${await response.text()}`)
  return response.json() as Promise<T>
}

export async function loadAdminEvents(): Promise<AcademyEventRecord[]> {
  return (await request<{ data: AcademyEventRecord[] }>('/api/events')).data
}

export async function createEvent(input: {
  title: string
  description?: string
  eventType: AcademyEventType
  modality: AcademyEventModality
  accessModel: AcademyEventAccessModel
  priceCents?: number | null
  startsAt: string
  endsAt: string
  registrationDeadline?: string | null
  capacity?: number | null
  venueName?: string | null
  addressText?: string | null
  meetingUrl?: string | null
  smartFarmExperience: boolean
  status?: AcademyEventStatus
}) {
  return request<{ data: AcademyEventRecord }>('/api/events', { method: 'POST', body: JSON.stringify(input) })
}

export async function updateEvent(input: Partial<AcademyEventRecord> & { eventId: string }) {
  return request<{ data: AcademyEventRecord }>('/api/events', { method: 'PUT', body: JSON.stringify(input) })
}

export async function cancelEvent(eventId: string) {
  return request<{ data: { id: string; status: 'cancelled' }; idempotent?: boolean }>(`/api/events?eventId=${encodeURIComponent(eventId)}`, { method: 'DELETE' })
}

export async function loadEventCatalog(): Promise<AcademyEventRecord[]> {
  return (await request<{ data: AcademyEventRecord[] }>('/api/event-catalog')).data
}

export async function loadMyEventRegistrations(): Promise<EventRegistrationRecord[]> {
  return (await request<{ data: EventRegistrationRecord[] }>('/api/event-registrations')).data
}

export async function registerForEvent(eventId: string, input?: { companyId?: string; marketingConsent?: boolean }) {
  return request<{ data: { id: string; eventId: string; status: EventRegistrationStatus; waitlisted: boolean; registeredAt: string }; idempotent?: boolean }>(
    '/api/event-registrations',
    { method: 'POST', body: JSON.stringify({ eventId, ...input }) },
  )
}

export async function cancelEventRegistration(eventId: string) {
  return request<{ data: { id: string; eventId: string; status: 'cancelled'; promotedRegistrationId?: string | null } }>(
    `/api/event-registrations?eventId=${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
  )
}

export async function loadEventAttendance(eventId: string): Promise<EventRegistrationRecord[]> {
  return (await request<{ data: EventRegistrationRecord[] }>(`/api/event-attendance?eventId=${encodeURIComponent(eventId)}`)).data
}

export async function recordEventAttendance(input: {
  registrationId: string
  action: 'checkin' | 'checkout' | 'no_show'
  evidenceType?: 'manual' | 'checkin_code' | 'qr' | 'geolocation' | 'signature' | 'document'
  evidence?: Record<string, unknown>
}) {
  return request<{ data: Record<string, unknown> }>('/api/event-attendance', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
