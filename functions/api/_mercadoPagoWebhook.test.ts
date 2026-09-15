import { describe, expect, it } from 'vitest'
import {
  classifyMercadoPagoNotificationType,
  mercadoPagoSignatureManifest,
  normalizeMercadoPagoDataId,
  parseMercadoPagoSignature,
  verifyMercadoPagoWebhookSignature,
} from './_mercadoPagoWebhook'

describe('Mercado Pago webhook signature', () => {
  it('parses x-signature ts/v1 strictly', () => {
    expect(parseMercadoPagoSignature(`ts=1742505638683,v1=${'a'.repeat(64)}`)).toEqual({ ts: '1742505638683', v1: 'a'.repeat(64) })
    expect(parseMercadoPagoSignature('ts=nope,v1=abc')).toBeNull()
    expect(parseMercadoPagoSignature(null)).toBeNull()
  })

  it('lowercases alphanumeric data.id and builds the official manifest', () => {
    const id = normalizeMercadoPagoDataId('ORD01JQ4S4KY8HWQ6NA5PXB65B3D3')
    expect(id).toBe('ord01jq4s4ky8hwq6na5pxb65b3d3')
    expect(mercadoPagoSignatureManifest({
      dataId: id!, requestId: '2066ca19-c6f1-498a-be75-1923005edd06', ts: '1742505638683',
    })).toBe('id:ord01jq4s4ky8hwq6na5pxb65b3d3;request-id:2066ca19-c6f1-498a-be75-1923005edd06;ts:1742505638683;')
  })

  it('validates an independent HMAC-SHA256 vector and rejects tampering', async () => {
    const input = {
      xSignature: 'ts=1742505638683,v1=d568551a3929afe312cfd5771e3fe9365a9ee7fbccd97712645be11c30059a51',
      xRequestId: '2066ca19-c6f1-498a-be75-1923005edd06',
      dataId: 'ORD01JQ4S4KY8HWQ6NA5PXB65B3D3',
      secret: 'test-secret',
    }
    await expect(verifyMercadoPagoWebhookSignature(input)).resolves.toMatchObject({ valid: true, ts: '1742505638683' })
    await expect(verifyMercadoPagoWebhookSignature({ ...input, dataId: 'other' })).resolves.toMatchObject({ valid: false, reason: 'signature_mismatch' })
    await expect(verifyMercadoPagoWebhookSignature({ ...input, xRequestId: null })).resolves.toMatchObject({ valid: false, reason: 'missing_request_id' })
  })

  it('only treats documented payment/subscription topics as supported', () => {
    expect(classifyMercadoPagoNotificationType('payment')).toBe('supported')
    expect(classifyMercadoPagoNotificationType('subscription_authorized_payment')).toBe('supported')
    expect(classifyMercadoPagoNotificationType('merchant_order')).toBe('ignored')
  })
})
