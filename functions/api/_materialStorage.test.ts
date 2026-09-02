import { describe, expect, it } from 'vitest'
import {
  MAX_MATERIAL_BYTES,
  buildMaterialObjectKey,
  materialDisposition,
  normalizeFileName,
  normalizeMaterialSize,
  resolveMaterialMime,
} from './_materialStorage'

describe('material storage rules', () => {
  it('normaliza nome sem path traversal', () => {
    expect(normalizeFileName('../../Plano Irrigação.pdf')).toBe('Plano-Irrigacao.pdf')
  })

  it('rejeita arquivo sem extensão conhecida', () => {
    expect(normalizeFileName('arquivo')).toBeNull()
    expect(resolveMaterialMime('arquivo.exe', 'application/octet-stream')).toBeNull()
  })

  it('infere MIME seguro quando browser envia octet-stream', () => {
    expect(resolveMaterialMime('material.pdf', 'application/octet-stream')).toBe('application/pdf')
  })

  it('rejeita MIME incompatível com extensão', () => {
    expect(resolveMaterialMime('material.pdf', 'image/png')).toBeNull()
  })

  it('limita tamanho do material', () => {
    expect(normalizeMaterialSize(MAX_MATERIAL_BYTES)).toBe(MAX_MATERIAL_BYTES)
    expect(normalizeMaterialSize(MAX_MATERIAL_BYTES + 1)).toBeNull()
  })

  it('gera chave segregada por tenant e recurso', () => {
    expect(buildMaterialObjectKey({
      tenantId: 'TENANT A',
      courseId: 'C001',
      lessonId: 'L001',
      assetId: 'asset-123',
      fileName: 'manual.pdf',
    })).toBe('academy/TENANT-A/C001/L001/asset-123/manual.pdf')
  })

  it('usa inline apenas para conteúdo visual seguro', () => {
    expect(materialDisposition('application/pdf')).toBe('inline')
    expect(materialDisposition('image/png')).toBe('inline')
    expect(materialDisposition('application/zip')).toBe('attachment')
  })
})
