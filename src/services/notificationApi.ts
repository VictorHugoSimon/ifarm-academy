import { authenticatedJson } from './authenticatedFetch'

export type NotificationCategory = 'academic'|'compliance'|'event'|'commercial'|'system'
export type NotificationPriority = 'normal'|'important'|'urgent'
export type NotificationStatus = 'unread'|'read'|'archived'

export interface AcademyNotification {
  id: string
  category: NotificationCategory
  notificationType: string
  title: string
  message: string
  actionPath?: string | null
  priority: NotificationPriority
  status: NotificationStatus
  required: boolean
  sourceType?: string | null
  sourceId?: string | null
  payload: Record<string, unknown>
  createdAt: string
  readAt?: string | null
  archivedAt?: string | null
  expiresAt?: string | null
}

export interface NotificationPreference {
  category: NotificationCategory
  inAppEnabled: boolean
  emailEnabled: false
  pushEnabled: false
  externalChannelsAvailable: false
  updatedAt?: string | null
}

function request<T>(url: string, init?: RequestInit): Promise<T> {
  return authenticatedJson<T>(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
}

export async function loadNotifications(status?: NotificationStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return request<{ data: AcademyNotification[]; unreadCount: number }>(`/api/notifications${query}`)
}

export async function updateNotification(action: 'mark_read'|'archive'|'mark_all_read', id?: string) {
  return request('/api/notifications', { method: 'POST', body: JSON.stringify({ action, ...(id ? { id } : {}) }) })
}

export async function loadNotificationPreferences(): Promise<NotificationPreference[]> {
  return (await request<{ data: NotificationPreference[] }>('/api/notification-preferences')).data
}

export async function updateNotificationPreference(category: NotificationCategory, inAppEnabled: boolean) {
  return request('/api/notification-preferences', { method: 'PUT', body: JSON.stringify({ category, inAppEnabled }) })
}
