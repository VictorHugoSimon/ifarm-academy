import { requireTrustedContext } from './_auth'
import { json, type Env } from './_shared'

const ADMIN_ROLES = ['academy_admin','ifarm_admin']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  return json({ data: { canManage: auth.roles.some((role) => ADMIN_ROLES.includes(role)) } })
}
