import { publicOrigin, robotsTxt } from './api/_publicSeo'
import { resolvePublicTenant } from './api/_publicTenant'
import { dbOr503, type Env } from './api/_shared'

export const onRequestGet=async({env,request}:{env:Env;request:Request})=>{
  const db=dbOr503(env);if(db instanceof Response)return db
  const context=await resolvePublicTenant(db,env,request)
  const production=String(env.ACADEMY_ENVIRONMENT??'').trim().toLowerCase()==='production'
  return new Response(robotsTxt({origin:publicOrigin(request),production,publicHostConfigured:Boolean(context)}),{
    headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=900, stale-while-revalidate=3600'},
  })
}
