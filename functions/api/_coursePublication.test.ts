import { describe, expect, it } from 'vitest'
import { resolveCourseTransition } from './_coursePublication'

describe('course publication state machine', () => {
  it('permite draft → review', () => {
    expect(resolveCourseTransition('draft', 'submit_review')).toEqual({
      ok: true,
      nextStatus: 'review',
    })
  })

  it('exige publicador e readiness para review → published', () => {
    expect(resolveCourseTransition('review', 'publish')).toEqual({
      ok: true,
      nextStatus: 'published',
      publisherRequired: true,
      readinessRequired: true,
    })
  })

  it('permite administrador devolver review para draft', () => {
    expect(resolveCourseTransition('review', 'return_draft')).toEqual({
      ok: true,
      nextStatus: 'draft',
      publisherRequired: true,
    })
  })

  it('permite arquivar somente curso publicado', () => {
    expect(resolveCourseTransition('published', 'archive')).toEqual({
      ok: true,
      nextStatus: 'archived',
      publisherRequired: true,
    })
    expect(resolveCourseTransition('draft', 'archive').ok).toBe(false)
  })

  it('bloqueia atalhos de governança', () => {
    expect(resolveCourseTransition('draft', 'publish').ok).toBe(false)
    expect(resolveCourseTransition('published', 'submit_review').ok).toBe(false)
    expect(resolveCourseTransition('archived', 'return_draft').ok).toBe(false)
  })
})
