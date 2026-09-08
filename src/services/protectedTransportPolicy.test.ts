import { describe, expect, it } from 'vitest'
import { shouldAuthenticateMaterialUpload } from './materialApi'

describe('protected transport policy', () => {
  it('mantém upload assinado externo fora do boundary Bearer da Academy', () => {
    const origin = 'https://academy.ifarm.test'
    expect(shouldAuthenticateMaterialUpload('/api/materials/1/content', origin)).toBe(true)
    expect(shouldAuthenticateMaterialUpload('https://storage.ifarm-cdn.test/upload/signed', origin)).toBe(false)
  })
})
