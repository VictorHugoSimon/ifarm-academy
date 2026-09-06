export type GamificationEventType =
  | 'lesson_completed'
  | 'course_completed'
  | 'quiz_approved'
  | 'certificate_issued'
  | 'event_attended'
  | 'smart_farm_activity'

export function utcDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('invalid gamification date')
  return date.toISOString().slice(0, 10)
}

export function dayDistance(previousDate: string, nextDate: string): number {
  const previous = new Date(`${previousDate}T00:00:00.000Z`)
  const next = new Date(`${nextDate}T00:00:00.000Z`)
  return Math.round((next.getTime() - previous.getTime()) / 86400000)
}

export function nextStreak(
  currentDays: number,
  bestDays: number,
  lastActivityDate: string | null,
  activityDate: string,
) {
  if (!lastActivityDate) return { currentDays: 1, bestDays: Math.max(1, bestDays), lastActivityDate: activityDate }
  const distance = dayDistance(lastActivityDate, activityDate)
  if (distance <= 0) return { currentDays, bestDays, lastActivityDate }
  const nextCurrent = distance === 1 ? currentDays + 1 : 1
  return { currentDays: nextCurrent, bestDays: Math.max(bestDays, nextCurrent), lastActivityDate: activityDate }
}

export interface RecordGamificationEventInput {
  tenantId: string
  userId: string
  eventType: GamificationEventType
  sourceType: string
  sourceId: string
  occurredAt?: string
}

export async function recordGamificationEvent(db: any, input: RecordGamificationEventInput) {
  const rule = await db.prepare(`
    SELECT * FROM academy_gamification_rules
    WHERE tenant_id=? AND event_type=? AND status='active'
    LIMIT 1
  `).bind(input.tenantId, input.eventType).first()
  if (!rule) return { awarded: false, reason: 'rule_not_configured', points: 0, badges: [] as any[] }

  const existing = await db.prepare(`
    SELECT id,points FROM academy_points_ledger
    WHERE tenant_id=? AND user_id=? AND event_type=? AND source_type=? AND source_id=?
    LIMIT 1
  `).bind(input.tenantId, input.userId, input.eventType, input.sourceType, input.sourceId).first()
  if (existing) return { awarded: false, idempotent: true, reason: 'already_awarded', points: Number(existing.points ?? 0), badges: [] as any[] }

  const occurredAt = input.occurredAt ?? new Date().toISOString()
  const ledgerId = crypto.randomUUID()
  await db.prepare(`
    INSERT OR IGNORE INTO academy_points_ledger (
      id,tenant_id,user_id,event_type,source_type,source_id,rule_id,points,occurred_at,created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?)
  `).bind(
    ledgerId,
    input.tenantId,
    input.userId,
    input.eventType,
    input.sourceType,
    input.sourceId,
    rule.id,
    Number(rule.points),
    occurredAt,
    occurredAt,
  ).run()

  const persisted = await db.prepare(`
    SELECT id,points FROM academy_points_ledger
    WHERE tenant_id=? AND user_id=? AND event_type=? AND source_type=? AND source_id=?
    LIMIT 1
  `).bind(input.tenantId, input.userId, input.eventType, input.sourceType, input.sourceId).first()
  if (!persisted || String(persisted.id) !== ledgerId) {
    return { awarded: false, idempotent: true, reason: 'already_awarded', points: Number(persisted?.points ?? 0), badges: [] as any[] }
  }

  const activityDate = utcDateKey(occurredAt)
  const streak = await db.prepare(`SELECT * FROM academy_streaks WHERE tenant_id=? AND user_id=? LIMIT 1`)
    .bind(input.tenantId, input.userId).first()
  const next = nextStreak(
    Number(streak?.current_days ?? 0),
    Number(streak?.best_days ?? 0),
    streak?.last_activity_date == null ? null : String(streak.last_activity_date),
    activityDate,
  )
  await db.prepare(`
    INSERT INTO academy_streaks (tenant_id,user_id,current_days,best_days,last_activity_date,updated_at)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(tenant_id,user_id) DO UPDATE SET
      current_days=excluded.current_days,
      best_days=excluded.best_days,
      last_activity_date=excluded.last_activity_date,
      updated_at=excluded.updated_at
  `).bind(input.tenantId, input.userId, next.currentDays, next.bestDays, next.lastActivityDate, occurredAt).run()

  const xpRow = await db.prepare(`SELECT COALESCE(SUM(points),0) AS total_xp FROM academy_points_ledger WHERE tenant_id=? AND user_id=?`)
    .bind(input.tenantId, input.userId).first()
  const totalXp = Number(xpRow?.total_xp ?? 0)
  const badgesResult = await db.prepare(`SELECT * FROM academy_badges WHERE tenant_id=? AND status='active' ORDER BY criterion_value,id`)
    .bind(input.tenantId).all()
  const awardedBadges: any[] = []

  for (const badge of badgesResult.results as any[]) {
    let achieved = false
    let evidence: Record<string, unknown> = {}
    if (badge.criterion_type === 'xp_total') {
      achieved = totalXp >= Number(badge.criterion_value)
      evidence = { totalXp, criterionValue: Number(badge.criterion_value) }
    } else if (badge.criterion_type === 'event_count') {
      const countRow = await db.prepare(`
        SELECT COUNT(*) AS event_count FROM academy_points_ledger
        WHERE tenant_id=? AND user_id=? AND event_type=?
      `).bind(input.tenantId, input.userId, badge.criterion_event_type).first()
      const eventCount = Number(countRow?.event_count ?? 0)
      achieved = eventCount >= Number(badge.criterion_value)
      evidence = { eventType: badge.criterion_event_type, eventCount, criterionValue: Number(badge.criterion_value) }
    }
    if (!achieved) continue

    const awardId = crypto.randomUUID()
    await db.prepare(`
      INSERT OR IGNORE INTO academy_user_badges (id,tenant_id,user_id,badge_id,awarded_at,evidence_json)
      VALUES (?,?,?,?,?,?)
    `).bind(awardId, input.tenantId, input.userId, badge.id, occurredAt, JSON.stringify(evidence)).run()
    const persistedAward = await db.prepare(`
      SELECT id FROM academy_user_badges WHERE tenant_id=? AND user_id=? AND badge_id=? LIMIT 1
    `).bind(input.tenantId, input.userId, badge.id).first()
    if (persistedAward && String(persistedAward.id) === awardId) {
      awardedBadges.push({ id: badge.id, code: badge.code, title: badge.title, awardedAt: occurredAt })
    }
  }

  return {
    awarded: true,
    ledgerId,
    points: Number(rule.points),
    totalXp,
    streak: next,
    badges: awardedBadges,
  }
}

export async function loadGamificationProfile(db: any, tenantId: string, userId: string) {
  const xpRow = await db.prepare(`SELECT COALESCE(SUM(points),0) AS total_xp FROM academy_points_ledger WHERE tenant_id=? AND user_id=?`)
    .bind(tenantId, userId).first()
  const totalXp = Number(xpRow?.total_xp ?? 0)
  const streak = await db.prepare(`SELECT * FROM academy_streaks WHERE tenant_id=? AND user_id=? LIMIT 1`)
    .bind(tenantId, userId).first()
  const currentLevel = await db.prepare(`
    SELECT * FROM academy_gamification_levels
    WHERE tenant_id=? AND status='active' AND min_xp<=?
    ORDER BY min_xp DESC LIMIT 1
  `).bind(tenantId, totalXp).first()
  const nextLevel = await db.prepare(`
    SELECT * FROM academy_gamification_levels
    WHERE tenant_id=? AND status='active' AND min_xp>?
    ORDER BY min_xp ASC LIMIT 1
  `).bind(tenantId, totalXp).first()
  const badges = await db.prepare(`
    SELECT ub.awarded_at,b.id,b.code,b.title,b.description
    FROM academy_user_badges ub
    JOIN academy_badges b ON b.id=ub.badge_id AND b.tenant_id=ub.tenant_id
    WHERE ub.tenant_id=? AND ub.user_id=?
    ORDER BY ub.awarded_at DESC
  `).bind(tenantId, userId).all()
  const recent = await db.prepare(`
    SELECT event_type,source_type,source_id,points,occurred_at
    FROM academy_points_ledger
    WHERE tenant_id=? AND user_id=?
    ORDER BY occurred_at DESC LIMIT 20
  `).bind(tenantId, userId).all()

  return {
    totalXp,
    level: currentLevel ? { id: currentLevel.id, name: currentLevel.name, minXp: Number(currentLevel.min_xp) } : null,
    nextLevel: nextLevel ? { id: nextLevel.id, name: nextLevel.name, minXp: Number(nextLevel.min_xp), remainingXp: Math.max(0, Number(nextLevel.min_xp) - totalXp) } : null,
    streak: {
      currentDays: Number(streak?.current_days ?? 0),
      bestDays: Number(streak?.best_days ?? 0),
      lastActivityDate: streak?.last_activity_date ?? null,
    },
    badges: badges.results,
    recentActivity: recent.results,
  }
}
