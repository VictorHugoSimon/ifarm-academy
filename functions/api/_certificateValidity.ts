export type CertificateValidityMode = 'not_configured' | 'indefinite' | 'fixed_months'
export type CertificateEffectiveStatus = 'valid' | 'expired' | 'revoked'

export interface StoredValidityPolicy {
  id: string
  tenant_id: string
  course_id: string
  validity_mode: 'indefinite' | 'fixed_months'
  validity_months?: number | null
  source_reference: string
  note: string
  version: number
  confirmed_by: string
  confirmed_at: string
}

export interface CertificateValiditySnapshot {
  validityMode: CertificateValidityMode
  validityPolicyVersion: number | null
  validityMonths: number | null
  validUntil: string | null
  snapshot: Record<string, unknown>
}

export function addMonthsClamped(value: string, months: number): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid completion date')
  if (!Number.isInteger(months) || months < 1 || months > 1200) throw new Error('Invalid validity months')

  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  const hour = date.getUTCHours()
  const minute = date.getUTCMinutes()
  const second = date.getUTCSeconds()
  const millisecond = date.getUTCMilliseconds()

  const targetFirst = new Date(Date.UTC(year, month + months, 1, hour, minute, second, millisecond))
  const lastDay = new Date(Date.UTC(
    targetFirst.getUTCFullYear(), targetFirst.getUTCMonth() + 1, 0,
    hour, minute, second, millisecond,
  )).getUTCDate()
  targetFirst.setUTCDate(Math.min(day, lastDay))
  return targetFirst.toISOString()
}

export function snapshotCertificateValidity(
  completionDate: string,
  policy?: StoredValidityPolicy | null,
): CertificateValiditySnapshot {
  if (!policy) {
    return {
      validityMode: 'not_configured',
      validityPolicyVersion: null,
      validityMonths: null,
      validUntil: null,
      snapshot: {},
    }
  }

  if (policy.validity_mode === 'indefinite') {
    return {
      validityMode: 'indefinite',
      validityPolicyVersion: Number(policy.version),
      validityMonths: null,
      validUntil: null,
      snapshot: {
        policyId: policy.id,
        version: Number(policy.version),
        mode: 'indefinite',
        sourceReference: policy.source_reference,
        note: policy.note,
        confirmedBy: policy.confirmed_by,
        confirmedAt: policy.confirmed_at,
      },
    }
  }

  const validityMonths = Number(policy.validity_months)
  return {
    validityMode: 'fixed_months',
    validityPolicyVersion: Number(policy.version),
    validityMonths,
    validUntil: addMonthsClamped(completionDate, validityMonths),
    snapshot: {
      policyId: policy.id,
      version: Number(policy.version),
      mode: 'fixed_months',
      validityMonths,
      sourceReference: policy.source_reference,
      note: policy.note,
      confirmedBy: policy.confirmed_by,
      confirmedAt: policy.confirmed_at,
    },
  }
}

export function certificateEffectiveStatus(
  storedStatus: string,
  validUntil?: string | null,
  now = new Date(),
): CertificateEffectiveStatus {
  if (storedStatus === 'revoked') return 'revoked'
  if (validUntil) {
    const end = new Date(validUntil)
    if (!Number.isNaN(end.getTime()) && end.getTime() < now.getTime()) return 'expired'
  }
  return 'valid'
}

export function validateValidityPolicyInput(input: {
  mode: unknown
  validityMonths?: unknown
  sourceReference?: unknown
  note?: unknown
  confirmed?: unknown
}) {
  const mode = String(input.mode ?? '')
  if (!['indefinite', 'fixed_months'].includes(mode)) return { ok: false as const, error: 'validityMode inválido' }
  if (input.confirmed !== true) return { ok: false as const, error: 'Confirmação humana explícita é obrigatória' }

  const sourceReference = String(input.sourceReference ?? '').trim()
  const note = String(input.note ?? '').trim()
  if (sourceReference.length < 3) return { ok: false as const, error: 'Fonte/referência da política é obrigatória' }
  if (note.length < 5) return { ok: false as const, error: 'Justificativa da política é obrigatória' }

  if (mode === 'indefinite') {
    return {
      ok: true as const,
      value: { mode: 'indefinite' as const, validityMonths: null, sourceReference, note },
    }
  }

  const validityMonths = Number(input.validityMonths)
  if (!Number.isInteger(validityMonths) || validityMonths < 1 || validityMonths > 1200) {
    return { ok: false as const, error: 'validityMonths deve estar entre 1 e 1200' }
  }
  return {
    ok: true as const,
    value: { mode: 'fixed_months' as const, validityMonths, sourceReference, note },
  }
}
