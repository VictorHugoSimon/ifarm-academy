import { publicOrigin, sitemapXml, type SitemapEntry } from './api/_publicSeo'
import { resolvePublicTenant } from './api/_publicTenant'
import { dbOr503, type Env } from './api/_shared'

function rows(result:any){return (result?.results??[]) as any[]}

export const onRequestGet=async({env,request}:{env:Env;request:Request})=>{
  const db=dbOr503(env);if(db instanceof Response)return db
  const context=await resolvePublicTenant(db,env,request)
  if(!context)return new Response('Not Found',{status:404,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}})

  const [courses,paths,instructors,events,plans,partners,bundles]=await Promise.all([
    db.prepare(`SELECT cp.slug FROM academy_course_public_profiles cp
      JOIN academy_courses c ON c.id=cp.course_id AND c.tenant_id=cp.tenant_id AND c.status='published'
      LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=cp.tenant_id AND ws.status='active'
      LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=cp.tenant_id AND wc.course_id=cp.course_id AND wc.visible=1
      WHERE cp.tenant_id=? AND cp.visibility='public'
        AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
      ORDER BY cp.slug`).bind(context.tenantId).all(),
    db.prepare(`SELECT p.slug FROM academy_public_learning_paths p
      WHERE p.tenant_id=? AND p.visibility='public' AND EXISTS(
        SELECT 1 FROM academy_public_learning_path_courses pc
        JOIN academy_courses c ON c.id=pc.course_id AND c.tenant_id=pc.tenant_id AND c.status='published'
        JOIN academy_course_public_profiles cp ON cp.course_id=c.id AND cp.tenant_id=c.tenant_id AND cp.visibility='public'
        LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=pc.tenant_id AND ws.status='active'
        LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=pc.tenant_id AND wc.course_id=pc.course_id AND wc.visible=1
        WHERE pc.tenant_id=p.tenant_id AND pc.path_id=p.id
          AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
      ) ORDER BY p.slug`).bind(context.tenantId).all(),
    db.prepare(`SELECT p.slug FROM academy_instructor_public_profiles p
      JOIN academy_instructors i ON i.id=p.instructor_id AND i.tenant_id=p.tenant_id AND i.status='active'
      WHERE p.tenant_id=? AND p.visibility='public' ORDER BY p.slug`).bind(context.tenantId).all(),
    db.prepare(`SELECT id FROM academy_events WHERE tenant_id=? AND status='published' AND datetime(ends_at)>=datetime('now') ORDER BY starts_at`).bind(context.tenantId).all(),
    db.prepare(`SELECT slug FROM academy_plans WHERE tenant_id=? AND status='public' ORDER BY slug`).bind(context.tenantId).all(),
    db.prepare(`SELECT slug FROM academy_public_partners WHERE tenant_id=? AND status='public' ORDER BY slug`).bind(context.tenantId).all(),
    db.prepare(`SELECT slug FROM academy_public_bundles WHERE tenant_id=? AND status='public' ORDER BY slug`).bind(context.tenantId).all(),
  ])

  const entries:SitemapEntry[]=[
    {path:'/',changeFrequency:'weekly',priority:1},
    {path:'/courses',changeFrequency:'daily',priority:.9},
    {path:'/paths',changeFrequency:'weekly',priority:.8},
    {path:'/instructors',changeFrequency:'weekly',priority:.7},
    {path:'/events',changeFrequency:'daily',priority:.8},
    {path:'/plans',changeFrequency:'weekly',priority:.7},
    {path:'/partners',changeFrequency:'monthly',priority:.6},
    {path:'/bundles',changeFrequency:'weekly',priority:.7},
  ]
  for(const row of rows(courses))entries.push({path:`/courses/${row.slug}`,changeFrequency:'weekly',priority:.8})
  for(const row of rows(paths))entries.push({path:`/paths/${row.slug}`,changeFrequency:'weekly',priority:.7})
  for(const row of rows(instructors))entries.push({path:`/instructors/${row.slug}`,changeFrequency:'monthly',priority:.6})
  for(const row of rows(events))entries.push({path:`/events/${encodeURIComponent(String(row.id))}`,changeFrequency:'daily',priority:.7})
  for(const row of rows(plans))entries.push({path:`/plans/${row.slug}`,changeFrequency:'weekly',priority:.7})
  for(const row of rows(partners))entries.push({path:`/partners/${row.slug}`,changeFrequency:'monthly',priority:.6})
  for(const row of rows(bundles))entries.push({path:`/bundles/${row.slug}`,changeFrequency:'weekly',priority:.7})

  return new Response(sitemapXml(publicOrigin(request),entries),{
    headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=900, stale-while-revalidate=3600'},
  })
}
