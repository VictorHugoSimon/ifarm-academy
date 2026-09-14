import { requireAdminContext } from './_auth'
import { paymentProviderReadiness } from './_payments'
import { json, type Env } from './_shared'

const ADMIN_ROLES = ['academy_admin','ifarm_admin']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ADMIN_ROLES)
  if (auth instanceof Response) return auth
  return json({
    data: paymentProviderReadiness(env),
    note: 'Readiness não expõe credenciais. Checkout/webhook só serão habilitados após implementação e homologação explícita do adapter.',
  })
}
