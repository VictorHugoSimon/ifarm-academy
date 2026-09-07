import { requireTrustedContext } from './_auth'
import { json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth

  return json({
    data: {
      userId: auth.userId,
      tenantId: auth.tenantId,
      identitySource: auth.identitySource,
      coreRole: auth.coreRole ?? null,
      roles: auth.roles,
      permissions: auth.permissions,
      mfaSatisfied: auth.mfaSatisfied ?? null,
    },
  })
}
