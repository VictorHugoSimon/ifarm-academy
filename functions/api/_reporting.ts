export interface ReportWindow {
  from: string
  to: string
  label: string
}

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_WINDOW_DAYS = 366

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))
}

function endOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999))
}

function parseDate(value: string | null, endOfDay: boolean): Date | null {
  if (!value) return null
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const parsed = dateOnly ? new Date(`${value}T00:00:00.000Z`) : new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return dateOnly ? (endOfDay ? endOfUtcDay(parsed) : startOfUtcDay(parsed)) : parsed
}

export function resolveReportWindow(request: Request, now = new Date()): ReportWindow | Response {
  const url = new URL(request.url)
  const fromRaw = url.searchParams.get('from')
  const toRaw = url.searchParams.get('to')

  const defaultTo = endOfUtcDay(now)
  const defaultFrom = startOfUtcDay(new Date(defaultTo.getTime() - 29 * DAY_MS))
  const from = fromRaw ? parseDate(fromRaw, false) : defaultFrom
  const to = toRaw ? parseDate(toRaw, true) : defaultTo

  if (!from || !to) return Response.json({ error: 'Período inválido' }, { status: 400 })
  if (from.getTime() > to.getTime()) return Response.json({ error: 'Data inicial deve ser anterior à data final' }, { status: 400 })
  const spanDays = Math.ceil((to.getTime() - from.getTime() + 1) / DAY_MS)
  if (spanDays > MAX_WINDOW_DAYS) return Response.json({ error: `Período máximo: ${MAX_WINDOW_DAYS} dias` }, { status: 400 })

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    label: `${from.toISOString().slice(0, 10)} a ${to.toISOString().slice(0, 10)}`,
  }
}

export function percent(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0
  return Math.round((part / total) * 10000) / 100
}

export function numberValue(value: unknown): number {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

export function nullableNumber(value: unknown): number | null {
  if (value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
