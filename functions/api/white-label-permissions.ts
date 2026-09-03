import { requireTrustedContext } from './_auth'
import { json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const admin = auth.roles.includes('academy_admin') || auth.roles.includes('ifarm_admin')
  return json({ data: { canConfigure: admin, canVerifyDomains: auth.roles.includes('ifarm_admin') } })
}
