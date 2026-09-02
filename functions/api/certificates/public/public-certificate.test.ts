import { describe, expect, it } from 'vitest'
import { onRequestGet } from './[code]'

function fakeDb(record: Record<string, unknown> | null) {
  return {
    prepare() {
      return {
        bind() {
          return { first: async () => record }
        },
      }
    },
  }
}

describe('public certificate function', () => {
  it('returns the public snapshot without internal identifiers', async () => {
    const response = await onRequestGet({
      env: {
        ACADEMY_DB: fakeDb({
          public_code: 'IFA-2026-ABC',
          student_name: 'Aluno Teste',
          course_title: 'Agricultura Digital',
          final_score: 92,
          issued_at: '2026-09-02T12:00:00.000Z',
          status: 'valid',
          workload_minutes: 120,
          instructor_label: 'Equipe iFarm',
          certificate_type: 'free_course',
          completion_date: '2026-09-01T12:00:00.000Z',
          metadata_version: 1,
          tenant_id: 'SHOULD-NOT-LEAK',
          student_id: 'SHOULD-NOT-LEAK',
        }),
      },
      params: { code: 'ifa-2026-abc' },
    } as any)

    expect(response.status).toBe(200)
    const payload = await response.json() as any
    expect(payload.valid).toBe(true)
    expect(payload.certificate.publicCode).toBe('IFA-2026-ABC')
    expect(payload.certificate.workloadMinutes).toBe(120)
    expect(payload.certificate.instructorLabel).toBe('Equipe iFarm')
    expect(JSON.stringify(payload)).not.toContain('SHOULD-NOT-LEAK')
  })

  it('returns 404 for unknown public code', async () => {
    const response = await onRequestGet({ env: { ACADEMY_DB: fakeDb(null) }, params: { code: 'UNKNOWN' } } as any)
    expect(response.status).toBe(404)
    const payload = await response.json() as any
    expect(payload.valid).toBe(false)
  })
})
