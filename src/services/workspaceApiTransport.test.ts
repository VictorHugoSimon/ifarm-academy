import { describe, expect, it } from 'vitest'
import { isWorkspaceApiRequest } from './workspaceApiTransport'

describe('workspace API transport', () => {
  it('autentica apenas chamadas API same-origin', () => {
    const origin = 'https://academy.ifarm.test'
    expect(isWorkspaceApiRequest('/api/reports', origin)).toBe(true)
    expect(isWorkspaceApiRequest('https://academy.ifarm.test/api/progress', origin)).toBe(true)
    expect(isWorkspaceApiRequest('/plans', origin)).toBe(false)
    expect(isWorkspaceApiRequest('https://core.ifarm.test/api/v1/me', origin)).toBe(false)
  })
})
