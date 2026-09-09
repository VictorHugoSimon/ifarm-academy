import { describe, expect, it, vi } from 'vitest'
import {
  buildTutorProviderEnvelope,
  redactTutorProviderText,
  runTutorProvider,
  tutorProviderRuntimeStatus,
  validateTutorProviderResponse,
} from './_tutorProvider'
import type { TutorEvidence } from './_tutor'

const evidence: TutorEvidence[] = [
  {
    id: 'chunk-1',
    courseId: 'course-1',
    lessonId: 'lesson-1',
    sourceTitle: 'Pressão e vazão',
    sourceType: 'lesson_body',
    text: 'Pressão e vazão devem ser verificadas antes da operação.',
    score: 4,
  },
  {
    id: 'chunk-2',
    courseId: 'course-1',
    lessonId: 'lesson-2',
    sourceTitle: 'Inspeção',
    sourceType: 'lesson_instructions',
    text: 'Registre os valores observados durante a atividade.',
    score: 2,
  },
]

describe('Tutor provider boundary', () => {
  it('permanece desligado por padrão', () => {
    expect(tutorProviderRuntimeStatus({})).toMatchObject({ mode: 'disabled', configured: false })
  })

  it('rejeita URL insegura ou configuração incompleta', () => {
    expect(tutorProviderRuntimeStatus({
      ACADEMY_TUTOR_PROVIDER_MODE: 'gateway_v1',
      ACADEMY_TUTOR_PROVIDER_URL: 'http://provider.example.com/generate',
      ACADEMY_TUTOR_PROVIDER_TOKEN: '1234567890123456',
    })).toMatchObject({ configured: false, reason: 'invalid_or_missing_url' })

    expect(tutorProviderRuntimeStatus({
      ACADEMY_TUTOR_PROVIDER_MODE: 'gateway_v1',
      ACADEMY_TUTOR_PROVIDER_URL: 'https://provider.example.com/generate',
    })).toMatchObject({ configured: false, reason: 'missing_provider_token' })
  })

  it('redige identificadores estruturados comuns antes do envio', () => {
    const redacted = redactTutorProviderText('Contato joao@example.com, CPF 123.456.789-00, telefone (18) 99999-1234.')
    expect(redacted).toContain('[REDACTED_EMAIL]')
    expect(redacted).toContain('[REDACTED_CPF]')
    expect(redacted).toContain('[REDACTED_PHONE]')
    expect(redacted).not.toContain('joao@example.com')
    expect(redacted).not.toContain('123.456.789-00')
  })

  it('monta envelope sem identidade de tenant/aluno e limita fontes', () => {
    const envelope = buildTutorProviderEnvelope('Como verificar pressão?', evidence)
    const serialized = JSON.stringify(envelope)
    expect(envelope.sources.map((source) => source.id)).toEqual(['S1', 'S2'])
    expect(serialized).not.toContain('tenant')
    expect(serialized).not.toContain('student')
    expect(envelope.instruction).toContain('exclusivamente com base nas fontes')
  })

  it('aceita resposta grounded apenas com citações permitidas e inline', () => {
    expect(validateTutorProviderResponse({
      grounded: true,
      answer: 'O material orienta verificar pressão e vazão antes da operação [S1].',
      citations: ['S1'],
    }, ['S1', 'S2'])).toEqual({
      valid: true,
      answer: 'O material orienta verificar pressão e vazão antes da operação [S1].',
      citationIds: ['S1'],
    })
  })

  it('rejeita resposta sem citação, citação desconhecida ou grounded=false', () => {
    expect(validateTutorProviderResponse({ grounded: true, answer: 'Sem fonte.', citations: [] }, ['S1'])).toMatchObject({ valid: false })
    expect(validateTutorProviderResponse({ grounded: true, answer: 'Texto [S9].', citations: ['S9'] }, ['S1'])).toMatchObject({ valid: false })
    expect(validateTutorProviderResponse({ grounded: false, answer: 'Não sei.', citations: [] }, ['S1'])).toMatchObject({ valid: false, reason: 'provider_not_grounded' })
  })

  it('rejeita parágrafo factual sem citação mesmo quando outro parágrafo está citado', () => {
    expect(validateTutorProviderResponse({
      grounded: true,
      answer: 'A pressão deve ser verificada [S1].\nA vazão também deve ser observada.',
      citations: ['S1'],
    }, ['S1'])).toMatchObject({ valid: false, reason: 'uncited_paragraph' })
  })

  it('chama gateway sem PII estrutural e aceita resposta válida', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = String(init?.body ?? '')
      expect(body).not.toContain('tenantId')
      expect(body).not.toContain('studentId')
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer 1234567890123456')
      return new Response(JSON.stringify({
        grounded: true,
        answer: 'Verifique pressão e vazão conforme o conteúdo da aula [S1].',
        citations: ['S1'],
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    })

    const result = await runTutorProvider({
      ACADEMY_TUTOR_PROVIDER_MODE: 'gateway_v1',
      ACADEMY_TUTOR_PROVIDER_URL: 'https://provider.example.com/generate',
      ACADEMY_TUTOR_PROVIDER_TOKEN: '1234567890123456',
    }, 'Como verificar pressão?', evidence, fetcher)

    expect(result).toMatchObject({ outcome: 'success', attempted: true, citationIds: ['S1'] })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('faz fallback seguro quando o gateway retorna payload inválido', async () => {
    const result = await runTutorProvider({
      ACADEMY_TUTOR_PROVIDER_MODE: 'gateway_v1',
      ACADEMY_TUTOR_PROVIDER_URL: 'https://provider.example.com/generate',
      ACADEMY_TUTOR_PROVIDER_TOKEN: '1234567890123456',
    }, 'Pergunta', evidence, async () => new Response(JSON.stringify({
      grounded: true,
      answer: 'Resposta sem citação.',
      citations: ['S1'],
    }), { status: 200 }))

    expect(result).toMatchObject({ outcome: 'invalid_response', attempted: true, fallbackReason: 'citation_not_inline' })
  })
})
