import { loadCoreMembershipDirectory } from './_coreDirectory'
import { requireEnterpriseContext } from './_enterpriseAuth'
import { json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireEnterpriseContext(env, request)
  if (auth instanceof Response) return auth

  const directory = await loadCoreMembershipDirectory(env, request, auth.tenantId)
  if (directory instanceof Response) return directory

  return json({
    data: directory.map((item) => ({
      membershipId: item.membershipId,
      userId: item.userId,
      displayName: item.displayName,
      email: item.email,
      organizationId: item.organizationId,
      roleCode: item.roleCode,
      status: item.status,
    })),
  })
}
