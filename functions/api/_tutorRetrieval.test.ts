import { describe, expect, it } from 'vitest'
import { buildEvidenceOnlyTutorAnswer, normalizeTutorText, retrieveTutorEvidence, tutorQueryTerms } from './_tutorRetrieval'

const items = [
  {
    moduleId: 'M1', moduleTitle: 'Irrigação inteligente', lessonId: 'L1', lessonTitle: 'Umidade do solo', contentType: 'text',
    body: 'Sensores de umidade do solo ajudam a acompanhar a disponibilidade de água e apoiam decisões de irrigação.',
  },
  {
    moduleId: 'M2', moduleTitle: 'IoT Rural', lessonId: 'L2', lessonTitle: 'LoRaWAN', contentType: 'text',
    body: 'LoRaWAN é uma tecnologia de comunicação de longo alcance e baixo consumo para dispositivos no campo.',
  },
]

describe('Tutor IA authorized retrieval', () => {
  it('normaliza acentos e caixa sem inventar tokens', () => {
    expect(normalizeTutorText('Irrigação e UMIDADE')).toBe('irrigacao e umidade')
    expect(tutorQueryTerms('Como funciona a irrigação com sensor de umidade?')).toEqual(expect.arrayContaining(['funciona', 'irrigacao', 'sensor', 'umidade']))
  })

  it('prioriza a aula que contém os termos da pergunta', () => {
    const citations = retrieveTutorEvidence('Como sensor de umidade ajuda na irrigação?', items)
    expect(citations[0]).toMatchObject({ moduleId: 'M1', lessonId: 'L1' })
    expect(citations[0].excerpt.toLowerCase()).toContain('umidade')
  })

  it('não retorna evidência quando o conteúdo autorizado não cobre o tema', () => {
    const citations = retrieveTutorEvidence('Como calcular imposto de renda?', items)
    expect(citations).toEqual([])
    expect(buildEvidenceOnlyTutorAnswer(citations)).toContain('Não encontrei conteúdo autorizado suficiente')
  })

  it('não usa URLs/provider refs como conteúdo de resposta', () => {
    const citations = retrieveTutorEvidence('token secreto storage', [{
      moduleId: 'M3', moduleTitle: 'Materiais', lessonId: 'L3', lessonTitle: 'Arquivo', contentType: 'file',
      label: 'Manual autorizado',
      // campos de infraestrutura nem fazem parte do contrato de retrieval
    }])
    expect(citations).toEqual([])
  })
})
