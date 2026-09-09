import { describe, expect, it } from 'vitest'
import { decideTutorQuota, tutorQuotaWindowStart, type TutorUsagePolicyEvaluation } from './_tutorQuota'

function policy(input: Partial<TutorUsagePolicyEvaluation> & { id: string; scope: 'tenant' | 'course' | 'student' }): TutorUsagePolicyEvaluation {
  return {
    policy: {
      id: input.id,
      tenant_id: 'T1',
      scope_type: input.scope,
      scope_id: input.scope === 'tenant' ? null : input.scope === 'course' ? 'C1' : 'U1',
      period: 'day',
      version: 1,
      max_provider_requests: 10,
      max_request_chars: 10_000,
      status: 'active',
      rationale: 'Controle de uso aprovado para teste.',
      approved_by: 'A1',
      approved_at: '2026-09-09T00:00:00.000Z',
      archived_at: null,
      created_at: '2026-09-09T00:00:00.000Z',
      ...input.policy,
    },
    usage: input.usage ?? { providerRequests: 0, requestChars: 0 },
    windowStartedAt: input.windowStartedAt ?? '2026-09-09T00:00:00.000Z',
  }
}

describe('Tutor usage quotas', () => {
  it('calcula janelas UTC determinísticas', () => {
    const now = new Date('2026-09-09T15:30:00.000Z')
    expect(tutorQuotaWindowStart('day', now)).toBe('2026-09-09T00:00:00.000Z')
    expect(tutorQuotaWindowStart('month', now)).toBe('2026-09-01T00:00:00.000Z')
  })

  it('bloqueia geração externa sem política de tenant explicitamente ativa', () => {
    const decision = decideTutorQuota([policy({ id: 'course', scope: 'course' })], 500)
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe('tenant_quota_not_configured')
  })

  it('respeita limite de chamadas de qualquer escopo aplicável', () => {
    const tenant = policy({ id: 'tenant', scope: 'tenant' })
    const student = policy({
      id: 'student',
      scope: 'student',
      usage: { providerRequests: 2, requestChars: 500 },
      policy: { max_provider_requests: 2 },
    })
    const decision = decideTutorQuota([tenant, student], 200)
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe('provider_requests_limit')
    expect(decision.blockedPolicy?.policy.id).toBe('student')
  })

  it('respeita orçamento de caracteres de entrada antes da chamada externa', () => {
    const tenant = policy({
      id: 'tenant',
      scope: 'tenant',
      usage: { providerRequests: 1, requestChars: 950 },
      policy: { max_request_chars: 1000 },
    })
    const decision = decideTutorQuota([tenant], 60)
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe('request_chars_limit')
  })

  it('permite quando todas as políticas aplicáveis possuem saldo', () => {
    const decision = decideTutorQuota([
      policy({ id: 'tenant', scope: 'tenant', usage: { providerRequests: 1, requestChars: 1000 } }),
      policy({ id: 'course', scope: 'course', usage: { providerRequests: 2, requestChars: 2500 } }),
    ], 400)
    expect(decision.allowed).toBe(true)
  })
})
