import { describe, expect, it } from 'vitest'
import { publicRecommendationRequestPath, type RecommendationSurface } from './editorialRecommendationsApi'

describe('public editorial recommendation request path', () => {
  it('usa home como superfície padrão sem contexto', () => {
    expect(publicRecommendationRequestPath()).toBe('/api/public/recommendations?surface=home')
  })

  it('preserva contexto explícito para todas as superfícies editoriais de detalhe', () => {
    const surfaces: RecommendationSurface[] = ['course','path','instructor','event','plan','partner','bundle']
    for (const surface of surfaces) {
      expect(publicRecommendationRequestPath({ surface, contextRef: 'CTX-1' }))
        .toBe(`/api/public/recommendations?surface=${surface}&contextRef=CTX-1`)
    }
  })
})
