import { resolvePublicTenant } from '../_publicTenant'
import { dbOr503, json, type Env } from '../_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const context = await resolvePublicTenant(db, env, request)
  if (!context) return json({ error: 'Portal público não configurado para este host' }, 404)

  return json({ data: {
    hostname: context.hostname,
    resolution: context.resolution,
    brand: context.brand,
    routes: {
      home: '/',
      catalog: '/courses',
      paths: '/paths',
      plans: '/plans',
      instructors: '/instructors',
      events: '/events',
      login: '/app',
      certificateValidation: '/certificates/validate',
    },
  } })
}
