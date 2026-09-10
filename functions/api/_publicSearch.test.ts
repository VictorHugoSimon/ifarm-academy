import { describe, expect, it } from 'vitest'
import {
  normalizePublicSearchText,
  parsePublicSearchFilters,
  searchPublicCandidates,
  type PublicSearchCandidate,
} from './_publicSearch'

const candidates: PublicSearchCandidate[] = [
  {
    type: 'course', id: 'C1', slug: 'irrigacao-inteligente', title: 'Irrigação Inteligente',
    description: 'Manejo de água e pivôs no campo', category: 'Irrigação', level: 'Intermediário',
    accessModel: 'free', featured: true, href: '/courses/irrigacao-inteligente', meta: ['pivô', 'água'],
  },
  {
    type: 'path', id: 'P1', slug: 'agricultura-digital', title: 'Trilha Agricultura Digital',
    description: 'Formação em agricultura digital e sensores', category: 'Agricultura Digital',
    accessModel: 'paid', featured: false, href: '/paths/agricultura-digital',
  },
  {
    type: 'instructor', id: 'I1', slug: 'ana-silva', title: 'Ana Silva',
    description: 'Especialista em irrigação', featured: false, href: '/instructors/ana-silva',
    meta: ['Irrigação', 'Agronomia'],
  },
  {
    type: 'event', id: 'E1', title: 'Dia de Campo: Irrigação', description: 'Prática na Smart Farm',
    category: 'field_day', accessModel: 'sponsored', modality: 'in_person', startsAt: '2026-10-01T12:00:00Z',
    featured: false, href: '/events',
  },
  {
    type: 'plan', id: 'PL1', slug: 'corporativo', title: 'Plano Corporativo',
    description: 'Capacitação de equipes', category: 'corporate', accessModel: 'contact_sales',
    featured: false, href: '/plans/corporativo',
  },
]

describe('Public Search v0.62', () => {
  it('normaliza acentos e espaços para comparação determinística', () => {
    expect(normalizePublicSearchText('  Irrigação   de Precisão ')).toBe('irrigacao de precisao')
  })

  it('aceita somente tipos públicos conhecidos e limita paginação', () => {
    const filters = parsePublicSearchFilters(new URL('https://academy.test/search?types=course,evil,event&limit=999&offset=-2'))
    expect(filters.types).toEqual(['course', 'event'])
    expect(filters.limit).toBe(48)
    expect(filters.offset).toBe(0)
  })

  it('busca em título, descrição e metadados sem comportamento do visitante', () => {
    const result = searchPublicCandidates(candidates, {
      query: 'irrigacao', types: ['course', 'path', 'instructor', 'event', 'plan'],
      category: '', access: '', level: '', modality: '', limit: 24, offset: 0,
    })
    expect(result.items.map((item) => item.id)).toEqual(['C1', 'I1', 'E1'])
    expect(result.items[0]?.type).toBe('course')
  })

  it('aplica filtros dimensionais sem ampliar o conjunto', () => {
    const result = searchPublicCandidates(candidates, {
      query: '', types: ['course', 'event'], category: '', access: 'sponsored', level: '', modality: 'in_person', limit: 24, offset: 0,
    })
    expect(result.items.map((item) => item.id)).toEqual(['E1'])
  })

  it('mantém facets calculadas sobre o conjunto textual antes da paginação', () => {
    const result = searchPublicCandidates(candidates, {
      query: '', types: ['course', 'path', 'instructor', 'event', 'plan'], category: '', access: '', level: '', modality: '', limit: 1, offset: 0,
    })
    expect(result.total).toBe(5)
    expect(result.items).toHaveLength(1)
    expect(result.facets.types.course).toBe(1)
    expect(result.facets.types.plan).toBe(1)
    expect(result.pagination.hasMore).toBe(true)
  })

  it('prioriza correspondência exata de título sobre destaque editorial incompatível', () => {
    const exact = { ...candidates[4], featured: false }
    const featuredLoose = { ...candidates[0], id: 'C2', title: 'Curso com plano para empresas', featured: true }
    const result = searchPublicCandidates([featuredLoose, exact], {
      query: 'Plano Corporativo', types: ['course', 'plan'], category: '', access: '', level: '', modality: '', limit: 24, offset: 0,
    })
    expect(result.items[0]?.id).toBe('PL1')
  })
})
