import { describe, expect, it } from 'vitest'
import { coreIdentityRequired, evaluateReadiness } from './readiness'

describe('Academy readiness environment policy', () => {
  it('exige Core em STAGE e PRODUCTION', () => {
    expect(coreIdentityRequired('stage')).toBe(true)
    expect(coreIdentityRequired('staging')).toBe(true)
    expect(coreIdentityRequired('prod')).toBe(true)
    expect(coreIdentityRequired('production')).toBe(true)
  })

  it('mantém fallback legado permitido apenas em DEV/test', () => {
    expect(coreIdentityRequired('dev')).toBe(false)
    expect(coreIdentityRequired('test')).toBe(false)
    expect(evaluateReadiness({
      environment: 'dev',
      database: true,
      identityBoundary: true,
      coreIdentityConfigured: false,
      storage: true,
    })).toEqual({ ready: true, coreRequired: false })
  })

  it('falha readiness em STAGE sem Core configurado', () => {
    expect(evaluateReadiness({
      environment: 'stage',
      database: true,
      identityBoundary: true,
      coreIdentityConfigured: false,
      storage: true,
    })).toEqual({ ready: false, coreRequired: true })
  })

  it('fica ready em STAGE apenas com todas as dependências obrigatórias', () => {
    expect(evaluateReadiness({
      environment: 'stage',
      database: true,
      identityBoundary: true,
      coreIdentityConfigured: true,
      storage: true,
    })).toEqual({ ready: true, coreRequired: true })
  })
})
