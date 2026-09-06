import { requireTrustedContext } from './_auth'
import { loadGamificationProfile } from './_gamification'
import { dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  return json({ data: await loadGamificationProfile(db, auth.tenantId, auth.userId) })
}
