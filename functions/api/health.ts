import { json } from './_shared'

export const onRequestGet = async () => json({
  service: 'ifarm-academy',
  status: 'ok',
  version: '0.11.0',
  timestamp: new Date().toISOString(),
})
