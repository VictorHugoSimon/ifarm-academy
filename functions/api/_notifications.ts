export type NotificationCategory = 'academic'|'compliance'|'event'|'commercial'|'system'
export type NotificationPriority = 'normal'|'important'|'urgent'

export interface CreateNotificationInput {
  tenantId: string
  userId: string
  category: NotificationCategory
  notificationType: string
  title: string
  message: string
  actionPath?: string | null
  priority?: NotificationPriority
  required?: boolean
  sourceType?: string | null
  sourceId?: string | null
  dedupeKey?: string | null
  payload?: Record<string, unknown>
  expiresAt?: string | null
  createdAt?: string
}

export function normalizeActionPath(value?: string | null): string | null {
  const path = String(value ?? '').trim()
  if (!path) return null
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    throw new Error('notification actionPath must be a relative application path')
  }
  if (path.length > 300) throw new Error('notification actionPath too long')
  return path
}

function cleanText(value: unknown, max: number, field: string) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`${field} is required`)
  if (text.length > max) throw new Error(`${field} too long`)
  return text
}

export async function createInAppNotification(db: any, input: CreateNotificationInput) {
  const title = cleanText(input.title, 120, 'title')
  const message = cleanText(input.message, 600, 'message')
  const notificationType = cleanText(input.notificationType, 80, 'notificationType')
  const actionPath = normalizeActionPath(input.actionPath)
  const required = input.required === true

  if (!required) {
    const preference = await db.prepare(`
      SELECT in_app_enabled FROM academy_notification_preferences
      WHERE tenant_id=? AND user_id=? AND category=? LIMIT 1
    `).bind(input.tenantId, input.userId, input.category).first()
    if (preference && Number(preference.in_app_enabled) !== 1) {
      return { created: false, suppressed: true, reason: 'preference_disabled' }
    }
  }

  if (input.dedupeKey) {
    const existing = await db.prepare(`
      SELECT id,status,created_at FROM academy_notifications
      WHERE tenant_id=? AND user_id=? AND dedupe_key=? LIMIT 1
    `).bind(input.tenantId, input.userId, input.dedupeKey).first()
    if (existing) return { created: false, idempotent: true, notification: existing }
  }

  const id = crypto.randomUUID()
  const createdAt = input.createdAt ?? new Date().toISOString()
  await db.prepare(`
    INSERT OR IGNORE INTO academy_notifications (
      id,tenant_id,user_id,category,notification_type,title,message,action_path,
      priority,status,required,source_type,source_id,dedupe_key,payload_json,created_at,expires_at
    ) VALUES (?,?,?,?,?,?,?,?,?,'unread',?,?,?,?,?,?,?)
  `).bind(
    id,
    input.tenantId,
    input.userId,
    input.category,
    notificationType,
    title,
    message,
    actionPath,
    input.priority ?? 'normal',
    required ? 1 : 0,
    input.sourceType ?? null,
    input.sourceId ?? null,
    input.dedupeKey ?? null,
    JSON.stringify(input.payload ?? {}),
    createdAt,
    input.expiresAt ?? null,
  ).run()

  const persisted = input.dedupeKey
    ? await db.prepare(`SELECT id,status,created_at FROM academy_notifications WHERE tenant_id=? AND user_id=? AND dedupe_key=? LIMIT 1`)
        .bind(input.tenantId, input.userId, input.dedupeKey).first()
    : await db.prepare(`SELECT id,status,created_at FROM academy_notifications WHERE id=? LIMIT 1`).bind(id).first()

  return {
    created: Boolean(persisted && String(persisted.id) === id),
    idempotent: Boolean(persisted && String(persisted.id) !== id),
    notification: persisted,
  }
}

/**
 * Adapter boundary for the future iFarm Core notification bus.
 * v0.38 intentionally implements only the Academy in-app inbox.
 */
export interface NotificationBridge {
  publish(event: {
    tenantId: string
    userId: string
    category: NotificationCategory
    notificationType: string
    sourceType?: string | null
    sourceId?: string | null
  }): Promise<void>
}
