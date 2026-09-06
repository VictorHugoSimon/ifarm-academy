import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const result = await db.prepare(`
    SELECT c.id,c.title,c.status,
      COALESCE(s.visible,0) AS selected,
      COALESCE(s.featured,0) AS featured
    FROM academy_courses c
    LEFT JOIN academy_white_label_catalog_courses s
      ON s.tenant_id=c.tenant_id AND s.course_id=c.id
    WHERE c.tenant_id=? AND c.status='published'
    ORDER BY c.title
  `).bind(auth.tenantId).all()
  return json({ data:(result.results as any[]).map((row)=>({ id:row.id,title:row.title,status:row.status,selected:Number(row.selected)===1,featured:Number(row.featured)===1 })) })
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string,unknown>
  try { body=await bodyJson(request) } catch { return json({error:'JSON inválido'},400) }
  const courseIds = Array.isArray(body.courseIds) ? Array.from(new Set(body.courseIds.map((v)=>String(v).trim()).filter(Boolean))) : []
  const featuredIds = Array.isArray(body.featuredCourseIds) ? new Set(body.featuredCourseIds.map((v)=>String(v).trim()).filter(Boolean)) : new Set<string>()
  if ([...featuredIds].some((id)=>!courseIds.includes(id))) return json({error:'Curso destacado precisa estar incluído no catálogo'},400)

  if (courseIds.length) {
    const placeholders=courseIds.map(()=>'?').join(',')
    const rows=await db.prepare(`SELECT id FROM academy_courses WHERE tenant_id=? AND status='published' AND id IN (${placeholders})`).bind(auth.tenantId,...courseIds).all()
    if ((rows.results as any[]).length !== courseIds.length) return json({error:'Um ou mais cursos não pertencem ao tenant ou não estão publicados'},400)
  }

  const now=new Date().toISOString()
  const statements:any[]=[db.prepare('DELETE FROM academy_white_label_catalog_courses WHERE tenant_id=?').bind(auth.tenantId)]
  for (const id of courseIds) {
    statements.push(db.prepare(`INSERT INTO academy_white_label_catalog_courses (tenant_id,course_id,visible,featured,updated_by,updated_at) VALUES (?,?,1,?,?,?)`).bind(auth.tenantId,id,featuredIds.has(id)?1:0,auth.userId,now))
  }
  statements.push(auditStatement(db,auth,{action:'white_label.catalog_scope_updated',resourceType:'white_label_catalog',resourceId:auth.tenantId,metadata:{selectedCount:courseIds.length,featuredCount:featuredIds.size}}))
  await db.batch(statements)
  return json({data:{courseIds,featuredCourseIds:[...featuredIds],updatedAt:now}})
}
