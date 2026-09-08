import { authenticatedJson } from './authenticatedFetch'

export type GamificationEventType = 'lesson_completed'|'course_completed'|'quiz_approved'|'certificate_issued'|'event_attended'|'smart_farm_activity'

export interface GamificationProfile {
  totalXp: number
  level: { id: string; name: string; minXp: number } | null
  nextLevel: { id: string; name: string; minXp: number; remainingXp: number } | null
  streak: { currentDays: number; bestDays: number; lastActivityDate?: string | null }
  badges: Array<{ id: string; code: string; title: string; description: string; awarded_at: string }>
  recentActivity: Array<{ event_type: GamificationEventType; source_type: string; source_id: string; points: number; occurred_at: string }>
}

function request<T>(url: string, init?: RequestInit): Promise<T> {
  return authenticatedJson<T>(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
}

export async function loadGamificationProfile(): Promise<GamificationProfile> {
  return (await request<{ data: GamificationProfile }>('/api/gamification-profile')).data
}

export async function loadGamificationPermissions(): Promise<{ canManage: boolean }> {
  return (await request<{ data: { canManage: boolean } }>('/api/gamification-permissions')).data
}

export async function loadGamificationRules(): Promise<any[]> {
  return (await request<{ data: any[] }>('/api/gamification-rules')).data
}

export async function activateGamificationRule(input: { eventType: GamificationEventType; points: number; rationale: string }) {
  return request('/api/gamification-rules', { method: 'POST', body: JSON.stringify(input) })
}

export async function loadGamificationBadges(): Promise<any[]> {
  return (await request<{ data: any[] }>('/api/gamification-badges')).data
}

export async function createGamificationBadge(input: {
  code: string
  title: string
  description: string
  criterionType: 'xp_total'|'event_count'
  criterionEventType?: GamificationEventType | null
  criterionValue: number
}) {
  return request('/api/gamification-badges', { method: 'POST', body: JSON.stringify(input) })
}

export async function loadGamificationLevels(): Promise<any[]> {
  return (await request<{ data: any[] }>('/api/gamification-levels')).data
}

export async function createGamificationLevel(input: { name: string; minXp: number; position: number }) {
  return request('/api/gamification-levels', { method: 'POST', body: JSON.stringify(input) })
}
