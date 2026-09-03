import { describe, expect, it } from 'vitest'
import { enforceRateLimit, resolveRequestId, resolveRouteScope } from './_operations'

function fakeRateDb() {
  let count = 0
  return {
    prepare(sql: string) {
      if (sql.includes('INSERT INTO academy_rate_limit_buckets')) {
        return { bind: () => ({ run: async () => { count += 1 } }) }
      }
      if (sql.includes('SELECT request_count')) {
        return { bind: () => ({ first: async () => ({ request_count: count }) }) }
      }
      if (sql.includes('INSERT INTO academy_operational_events')) {
        return { bind: () => ({ run: async () => ({ success: true }) }) }
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    },
  }
}

describe('operations helpers', () => {
  it('preserves a safe incoming request id and rejects unsafe values', () => {
    expect(resolveRequestId(new Request('https://academy.test/api/x', { headers: { 'x-request-id': 'req-123' } }))).toBe('req-123')
    const generated = resolveRequestId(new Request('https://academy.test/api/x', { headers: { 'x-request-id': 'bad id with spaces' } }))
    expect(generated).not.toBe('bad id with spaces')
    expect(generated.length).toBeGreaterThan(10)
  })

  it('classifies health, public validation, reads and writes', () => {
    expect(resolveRouteScope(new Request('https://academy.test/api/health'))).toBe('health')
    expect(resolveRouteScope(new Request('https://academy.test/api/certificates/public/ABC'))).toBe('public_certificate')
    expect(resolveRouteScope(new Request('https://academy.test/api/reports'))).toBe('read')
    expect(resolveRouteScope(new Request('https://academy.test/api/courses', { method: 'POST' }))).toBe('write')
  })

  it('returns 429 after the configured fixed-window limit', async () => {
    const db = fakeRateDb()
    const env = {
      ACADEMY_DB: db,
      ACADEMY_RATE_LIMIT_WRITE_PER_MINUTE: '2',
    } as any
    const request = new Request('https://academy.test/api/courses', {
      method: 'POST',
      headers: { 'cf-connecting-ip': '203.0.113.10' },
    })

    expect(await enforceRateLimit(env, request, 'REQ-1')).toBeNull()
    expect(await enforceRateLimit(env, request, 'REQ-2')).toBeNull()
    const blocked = await enforceRateLimit(env, request, 'REQ-3')
    expect(blocked?.status).toBe(429)
    expect(blocked?.headers.get('x-request-id')).toBe('REQ-3')
  })
})
