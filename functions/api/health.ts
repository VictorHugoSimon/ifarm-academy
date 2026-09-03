import { json, type Env } from './_shared'

export const onRequestGet = async ({ env }: { env: Env }) => json({
  service: 'ifarm-academy',
  status: 'ok',
  environment: env.ACADEMY_ENVIRONMENT ?? 'unknown',
  release: env.ACADEMY_RELEASE ?? 'unknown',
  timestamp: new Date().toISOString(),
})
