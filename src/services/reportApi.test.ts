import { describe, expect, it } from 'vitest'
import { rowsToCsv } from './reportApi'

describe('report CSV export', () => {
  it('serializes headers and values', () => {
    expect(rowsToCsv([{ curso: 'Agricultura Digital', conclusao: 75 }]))
      .toBe('curso,conclusao\nAgricultura Digital,75')
  })

  it('escapes commas, quotes and nested values', () => {
    const csv = rowsToCsv([{ nome: 'Fazenda "Boa, Safra"', dados: { ativo: true } }])
    expect(csv).toContain('"Fazenda ""Boa, Safra"""')
    expect(csv).toContain('"{""ativo"":true}"')
  })

  it('returns an empty string for empty report blocks', () => {
    expect(rowsToCsv([])).toBe('')
  })
})
