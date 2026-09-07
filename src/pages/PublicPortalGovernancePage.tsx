import { FormEvent, useEffect, useMemo, useState } from 'react'
import { loadPublicCourseProfiles, savePublicCourseProfile, type PublicCourseProfileAdmin } from '../services/publicPortalAdminApi'
import '../styles/public-portal-admin.css'

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120)
}

export function PublicPortalGovernancePage() {
  const [courses, setCourses] = useState<PublicCourseProfileAdmin[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ slug:'',category:'',levelLabel:'',shortDescription:'',audienceText:'',coverRef:'',visibility:'hidden' as 'hidden'|'public',accessModel:'not_configured' as PublicCourseProfileAdmin['accessModel'],price:'',featured:false,seoTitle:'',seoDescription:'' })

  const selected = useMemo(() => courses.find((item) => item.courseId === selectedId) ?? null, [courses, selectedId])

  async function refresh() {
    try { const data = await loadPublicCourseProfiles(); setCourses(data); if (!selectedId && data.length) setSelectedId(data[0].courseId) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível carregar a governança do portal.') }
  }
  useEffect(() => { void refresh() }, [])
  useEffect(() => {
    if (!selected) return
    setForm({
      slug:selected.slug || slugify(selected.courseTitle), category:selected.category || '', levelLabel:selected.levelLabel || '', shortDescription:selected.shortDescription || '', audienceText:selected.audienceText || '', coverRef:selected.coverRef || '',
      visibility:selected.visibility, accessModel:selected.accessModel, price:selected.listPriceCents == null ? '' : String(selected.listPriceCents / 100), featured:selected.featured, seoTitle:selected.seoTitle || '', seoDescription:selected.seoDescription || '',
    })
  }, [selectedId, selected?.updatedAt])

  async function save(event: FormEvent) {
    event.preventDefault(); if (!selected) return
    const numeric = form.price.trim() ? Number(form.price.replace(',','.')) : null
    try {
      await savePublicCourseProfile({
        courseId:selected.courseId, slug:form.slug, category:form.category || null, levelLabel:form.levelLabel || null,
        shortDescription:form.shortDescription || null, audienceText:form.audienceText || null, coverRef:form.coverRef || null,
        visibility:form.visibility, accessModel:form.accessModel,
        listPriceCents:numeric == null ? null : Math.round(numeric * 100), featured:form.featured,
        seoTitle:form.seoTitle || null, seoDescription:form.seoDescription || null,
      })
      await refresh(); setMessage('Perfil público do curso atualizado.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao salvar perfil público.') }
  }

  const publicCount = courses.filter((item) => item.visibility === 'public').length
  const pendingCount = courses.filter((item) => item.courseStatus === 'published' && item.visibility !== 'public').length

  return <div className="publicPortalAdmin">
    <div className="pageHeader"><div><h1>Portal Público</h1><p>Controle quais cursos academicamente publicados podem aparecer no site comercial da Academy.</p>{message && <small>{message}</small>}</div><button onClick={() => window.open('/', '_blank', 'noopener,noreferrer')}>Abrir portal</button></div>
    <section className="portalAdminMetrics"><article><span>Cursos cadastrados</span><strong>{courses.length}</strong></article><article><span>Visíveis no portal</span><strong>{publicCount}</strong></article><article><span>Publicados sem perfil público</span><strong>{pendingCount}</strong></article></section>
    <section className="portalAdminLayout">
      <aside className="panel"><div className="panelTitle"><h2>Cursos</h2><span>{courses.length}</span></div><div className="portalCourseList">{courses.map((course) => <button key={course.courseId} className={selectedId === course.courseId ? 'active' : ''} onClick={() => setSelectedId(course.courseId)}><strong>{course.courseTitle}</strong><span>{course.courseStatus} · {course.visibility === 'public' ? 'Público' : 'Oculto'}</span></button>)}</div></aside>
      {selected && <form className="panel portalProfileForm" onSubmit={save}><div className="panelTitle"><div><h2>{selected.courseTitle}</h2><span>Status acadêmico: {selected.courseStatus}</span></div></div>
        <div className="portalFormGrid"><label>Slug<input required value={form.slug} onChange={(e) => setForm({...form,slug:e.target.value.toLowerCase()})} /></label><label>Categoria<input value={form.category} onChange={(e) => setForm({...form,category:e.target.value})} /></label><label>Nível<input value={form.levelLabel} onChange={(e) => setForm({...form,levelLabel:e.target.value})} /></label><label>Acesso<select value={form.accessModel} onChange={(e) => setForm({...form,accessModel:e.target.value as typeof form.accessModel})}><option value="not_configured">Não configurado</option><option value="free">Gratuito</option><option value="paid">Pago</option><option value="sponsored">Patrocinado</option><option value="included">Incluído no plano</option></select></label>{form.accessModel === 'paid' && <label>Preço de lista (R$)<input required type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => setForm({...form,price:e.target.value})} /></label>}<label>Visibilidade<select value={form.visibility} onChange={(e) => setForm({...form,visibility:e.target.value as 'hidden'|'public'})}><option value="hidden">Oculto</option><option value="public">Público</option></select></label></div>
        <label>Resumo público<textarea maxLength={280} value={form.shortDescription} onChange={(e) => setForm({...form,shortDescription:e.target.value})} /></label><label>Público-alvo<textarea maxLength={500} value={form.audienceText} onChange={(e) => setForm({...form,audienceText:e.target.value})} /></label><label>Referência de capa<input placeholder="https://... ou /assets/..." value={form.coverRef} onChange={(e) => setForm({...form,coverRef:e.target.value})} /></label><div className="portalFormGrid"><label>Título SEO<input maxLength={120} value={form.seoTitle} onChange={(e) => setForm({...form,seoTitle:e.target.value})} /></label><label>Descrição SEO<input maxLength={220} value={form.seoDescription} onChange={(e) => setForm({...form,seoDescription:e.target.value})} /></label></div><label className="portalCheck"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({...form,featured:e.target.checked})} /> Destacar no portal</label>
        {form.accessModel === 'paid' && <p className="portalWarning">O preço pode ser exibido publicamente, mas checkout permanece indisponível até homologação do Mercado Pago.</p>}
        {selected.courseStatus !== 'published' && form.visibility === 'public' && <p className="portalWarning">O curso precisa estar academicamente publicado antes de ficar visível no portal.</p>}
        <button className="primary">Salvar perfil público</button>
      </form>}
    </section>
  </div>
}
