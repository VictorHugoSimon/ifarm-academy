import { describe, expect, it } from 'vitest'
import { onRequestGet } from './my-certificates'

function fakeDb(rows: Record<string, unknown>[]) {
  return {
    prepare(sql: string) {
      expect(sql).toContain('WHERE cert.tenant_id=? AND cert.student_id=?')
      expect(sql).toContain('LEFT JOIN academy_learning_cycles lc')
      return {
        bind(...values: unknown[]) {
          expect(values).toEqual(['TENANT-A', 'STUDENT-A'])
          return { all: async () => ({ results: rows }) }
        },
      }
    },
  }
}

describe('my-certificates function', () => {
  it('uses trusted tenant/student identity and maps cycle-aware public fields', async () => {
    const request = new Request('https://academy.test/api/my-certificates', {
      headers: {
        'x-ifarm-proxy-secret': 'secret',
        'x-ifarm-user-id': 'STUDENT-A',
        'x-ifarm-tenant-id': 'TENANT-A',
        'x-ifarm-roles': 'student',
      },
    })

    const response = await onRequestGet({
      env: {
        ACADEMY_ADMIN_PROXY_SECRET: 'secret',
        ACADEMY_DB: fakeDb([{
          id: 'CERT-1',
          cycle_id: 'CYCLE-2',
          cycle_number: 2,
          public_code: 'IFA-2026-TEST',
          course_id: 'COURSE-1',
          course_title: 'Agricultura Digital',
          final_score: 90,
          issued_at: '2026-09-02T12:00:00.000Z',
          status: 'valid',
          workload_minutes: 120,
          instructor_label: 'Equipe iFarm',
          certificate_type: 'free_course',
          completion_date: '2026-09-01T12:00:00.000Z',
          metadata_version: 1,
        }]),
      },
      request,
    } as any)

    expect(response.status).toBe(200)
    const payload = await response.json() as any
    expect(payload.data).toHaveLength(1)
    expect(payload.data[0]).toMatchObject({
      publicCode: 'IFA-2026-TEST',
      courseId: 'COURSE-1',
      cycleId: 'CYCLE-2',
      cycleNumber: 2,
      workloadMinutes: 120,
      certificateType: 'free_course',
    })
  })

  it('fails closed without the identity boundary secret', async () => {
    const response = await onRequestGet({
      env: { ACADEMY_DB: fakeDb([]) },
      request: new Request('https://academy.test/api/my-certificates'),
    } as any)
    expect(response.status).toBe(503)
  })
})
