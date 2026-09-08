import { describe, expect, it } from 'vitest'
import { shouldAuthenticateMaterialUpload } from './materialApi'

describe('material upload authorization boundary', () => {
  const origin = 'https://academy.ifarm.test'

  it('usa Bearer da Academy somente em upload same-origin', () => {
    expect(shouldAuthenticateMaterialUpload('/api/materials/asset-1/content', origin)).toBe(true)
    expect(shouldAuthenticateMaterialUpload('https://academy.ifarm.test/api/materials/asset-1/content', origin)).toBe(true)
  })

  it('não envia Bearer da Academy para storage externo assinado', () => {
    expect(shouldAuthenticateMaterialUpload('https://storage.example.com/signed/upload?token=abc', origin)).toBe(false)
    expect(shouldAuthenticateMaterialUpload('https://cdn.example.net/material', origin)).toBe(false)
  })

  it('falha de forma conservadora para URL inválida', () => {
    expect(shouldAuthenticateMaterialUpload('http://[invalid', origin)).toBe(false)
  })
})
