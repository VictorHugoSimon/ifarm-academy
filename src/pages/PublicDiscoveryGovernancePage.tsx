import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  createPublicLearningPath,
  loadInstructorPublicProfiles,
  loadPublicCourseProfiles,
  loadPublicLearningPaths,
  saveInstructorPublicProfile,
  savePublicLearningPath,
  type InstructorPublicProfileAdmin,
  type PublicCourseProfileAdmin,
  type PublicLearningPathAdmin,
} from '../services/publicPortalAdminApi'
import '../styles/public-portal-admin.css'
import '../styles/public-discovery-admin.css'

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120)
}

type AccessModel = PublicCourseProfileAdmin['accessModel']

export function PublicDiscoveryGovernancePage() {
  const [instructors, setInstructors] = useState<InstructorPublicProfileAdmin[]>([])
  const [paths, setPaths] = useState<PublicLearningPathAdmin[]>([])
  const [courses, setCourses] = useState<PublicCourseProfileAdmin[]>([])
  const [selectedInstructorId, setSelectedInstructorId] = useState('')
  const [selectedPathId, setSelectedPathId] = useState('new')
  const [message, setMessage] = useState('')
  const [instructorForm, setInstructorForm] = useState({ slug:'',visibility:'hidden' as 'hidden'|'public',headline:'',shortBio:'',photoRef:'',specialties:'',credentialSummary:'',featured:false,seoTitle:'',seoDescription:'' })
  const [pathForm, setPathForm] = useState({ title:'',slug:'',shortDescription:'',description:'',category:'',coverRef:'',visibility:'hidden' as 'hidden'|'public',featured:false,accessModel:'not_configured' as AccessModel,price:'',seoTitle:'',seoDescription:'',courseIds:[] as string[] })

  const selectedInstructor = useMemo(() => instructors.find((item) => item.instructorId === selectedInstructorId) ?? null, [instructors, selectedInstructorId])
  const selectedPath = useMemo(() => paths.find((item) => item.id === selectedPathId) ?? null, [paths, selectedPathId])
  const eligibleCourses = useMemo(() => courses.filter((course) => course.courseStatus === 'published' && course.visibility === 'public'), [courses])

  async function refresh() {
    try {
      const [instructorData, pathData, courseData] = await Promise.all([loadInstructorPublicProfiles(), loadPublicLearningPaths(), loadPublicCourseProfiles()])
      setInstructors(instructorData); setPaths(pathData); setCourses(courseData)
      if (!selectedInstructorId && instructorData.length) setSelectedInstructorId(instructorData[0].instructorId)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível carregar a governança pública.') }
  }
  useEffect(() => { void refresh() }, [])

  useEffect(() => {
    if (!selectedInstructor) return
    setInstructorForm({
      slug:selectedInstructor.slug || slugify(selectedInstructor.displayName), visibility:selectedInstructor.visibility,
      headline:selectedInstructor.headline || '', shortBio:selectedInstructor.shortBio || '', photoRef:selectedInstructor.photoRef || '',
      specialties:selectedInstructor.specialties.join(', '), credentialSummary:selectedInstructor.credentialSummary || '', featured:selectedInstructor.featured,
      seoTitle:selectedInstructor.seoTitle || '', seoDescription:selectedInstructor.seoDescription || '',
    })
  }, [selectedInstructorId, selectedInstructor?.updatedAt])

  useEffect(() => {
    if (!selectedPath) {
      setPathForm({ title:'',slug:'',shortDescription:'',description:'',category:'',coverRef:'',visibility:'hidden',featured:false,accessModel:'not_configured',price:'',seoTitle:'',seoDescription:'',courseIds:[] })
      return
    }
    setPathForm({
      title:selectedPath.title, slug:selectedPath.slug, shortDescription:selectedPath.shortDescription || '', description:selectedPath.description || '', category:selectedPath.category || '', coverRef:selectedPath.coverRef || '',
      visibility:selectedPath.visibility, featured:selectedPath.featured, accessModel:selectedPath.accessModel,
      price:selectedPath.listPriceCents == null ? '' : String(selectedPath.listPriceCents / 100), seoTitle:selectedPath.seoTitle || '', seoDescription:selectedPath.seoDescription || '',
      courseIds:selectedPath.courses.sort((a,b) => a.position-b.position).map((course) => course.courseId),
    })
  }, [selectedPathId, selectedPath?.updatedAt])

  async function saveInstructor(event: FormEvent) {
    event.preventDefault(); if (!selectedInstructor) return
    try {
      await saveInstructorPublicProfile({
        instructorId:selectedInstructor.instructorId, slug:instructorForm.slug, visibility:instructorForm.visibility,
        headline:instructorForm.headline || null, shortBio:instructorForm.shortBio || null, photoRef:instructorForm.photoRef || null,
        specialties:instructorForm.specialties.split(',').map((item) => item.trim()).filter(Boolean), credentialSummary:instructorForm.credentialSummary || null,
        featured:instructorForm.featured, seoTitle:instructorForm.seoTitle || null, seoDescription:instructorForm.seoDescription || null,
      })
      await refresh(); setMessage('Perfil público do instrutor atualizado.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao salvar perfil.') }
  }

  function toggleCourse(courseId: string) {
    setPathForm((current) => ({ ...current, courseIds: current.courseIds.includes(courseId) ? current.courseIds.filter((id) => id !== courseId) : [...current.courseIds, courseId] }))
  }

  async function savePath(event: FormEvent) {
    event.preventDefault()
    const numeric = pathForm.price.trim() ? Number(pathForm.price.replace(',','.')) : null
    const payload = {
      title:pathForm.title, slug:pathForm.slug || slugify(pathForm.title), shortDescription:pathForm.shortDescription || null,
      description:pathForm.description, category:pathForm.category || null, coverRef:pathForm.coverRef || null,
      visibility:pathForm.visibility, featured:pathForm.featured, accessModel:pathForm.accessModel,
      listPriceCents:numeric == null ? null : Math.round(numeric * 100), currency:'BRL', seoTitle:pathForm.seoTitle || null, seoDescription:pathForm.seoDescription || null,
      courseIds:pathForm.courseIds,
    }
    try {
      if (selectedPath) await savePublicLearningPath({ pathId:selectedPath.id, ...payload })
      else await createPublicLearningPath(payload)
      await refresh(); setMessage(selectedPath ? 'Trilha pública atualizada.' : 'Trilha pública criada.'); if (!selectedPath) setSelectedPathId('new')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao salvar trilha.') }
  }

  return <div className="publicDiscoveryAdmin">
    <div className="pageHeader"><div><h1>Trilhas & Instrutores Públicos</h1><p>Projeções comerciais separadas da governança técnica e das trilhas empresariais obrigatórias.</p>{message && <small>{message}</small>}</div><div className="headerActions"><button onClick={() => window.open('/paths','_blank','noopener,noreferrer')}>Ver trilhas</button><button onClick={() => window.open('/instructors','_blank','noopener,noreferrer')}>Ver instrutores</button></div></div>

    <section className="discoveryAdminSection"><div className="panelTitle"><div><h2>Perfis públicos de instrutor</h2><span>Nenhuma qualificação privada é publicada automaticamente.</span></div></div><div className="discoveryAdminLayout"><aside className="panel publicList">{instructors.map((item) => <button key={item.instructorId} className={selectedInstructorId === item.instructorId ? 'active' : ''} onClick={() => setSelectedInstructorId(item.instructorId)}><strong>{item.displayName}</strong><span>{item.instructorStatus} · {item.visibility}</span></button>)}</aside>{selectedInstructor && <form className="panel discoveryForm" onSubmit={saveInstructor}><div className="portalFormGrid"><label>Slug<input required value={instructorForm.slug} onChange={(e) => setInstructorForm({...instructorForm,slug:e.target.value.toLowerCase()})} /></label><label>Visibilidade<select value={instructorForm.visibility} onChange={(e) => setInstructorForm({...instructorForm,visibility:e.target.value as 'hidden'|'public'})}><option value="hidden">Oculto</option><option value="public">Público</option></select></label><label>Headline<input maxLength={140} value={instructorForm.headline} onChange={(e) => setInstructorForm({...instructorForm,headline:e.target.value})} /></label><label>Foto<input placeholder="https://... ou /assets/..." value={instructorForm.photoRef} onChange={(e) => setInstructorForm({...instructorForm,photoRef:e.target.value})} /></label></div><label>Bio pública<textarea maxLength={1000} value={instructorForm.shortBio} onChange={(e) => setInstructorForm({...instructorForm,shortBio:e.target.value})} /></label><label>Especialidades públicas, separadas por vírgula<input value={instructorForm.specialties} onChange={(e) => setInstructorForm({...instructorForm,specialties:e.target.value})} /></label><label>Resumo profissional publicado<textarea maxLength={240} value={instructorForm.credentialSummary} onChange={(e) => setInstructorForm({...instructorForm,credentialSummary:e.target.value})} /></label><div className="portalFormGrid"><label>Título SEO<input maxLength={160} value={instructorForm.seoTitle} onChange={(e) => setInstructorForm({...instructorForm,seoTitle:e.target.value})} /></label><label>Descrição SEO<input maxLength={320} value={instructorForm.seoDescription} onChange={(e) => setInstructorForm({...instructorForm,seoDescription:e.target.value})} /></label></div><label className="portalCheck"><input type="checkbox" checked={instructorForm.featured} onChange={(e) => setInstructorForm({...instructorForm,featured:e.target.checked})} /> Destacar perfil</label>{selectedInstructor.instructorStatus !== 'active' && instructorForm.visibility === 'public' && <p className="portalWarning">Instrutor inativo não pode ser publicado.</p>}<button className="primary">Salvar perfil público</button></form>}</div></section>

    <section className="discoveryAdminSection"><div className="panelTitle"><div><h2>Trilhas públicas</h2><span>Não reutilizam periodicidade, obrigatoriedade ou atribuição das trilhas empresariais.</span></div><button onClick={() => setSelectedPathId('new')}>Nova trilha</button></div><div className="discoveryAdminLayout"><aside className="panel publicList"><button className={selectedPathId === 'new' ? 'active' : ''} onClick={() => setSelectedPathId('new')}><strong>Nova trilha</strong><span>Criar projeção pública</span></button>{paths.map((item) => <button key={item.id} className={selectedPathId === item.id ? 'active' : ''} onClick={() => setSelectedPathId(item.id)}><strong>{item.title}</strong><span>{item.visibility} · {item.courses.length} cursos</span></button>)}</aside><form className="panel discoveryForm" onSubmit={savePath}><div className="portalFormGrid"><label>Título<input required value={pathForm.title} onChange={(e) => setPathForm({...pathForm,title:e.target.value,slug:selectedPath ? pathForm.slug : slugify(e.target.value)})} /></label><label>Slug<input required value={pathForm.slug} onChange={(e) => setPathForm({...pathForm,slug:e.target.value.toLowerCase()})} /></label><label>Categoria<input value={pathForm.category} onChange={(e) => setPathForm({...pathForm,category:e.target.value})} /></label><label>Visibilidade<select value={pathForm.visibility} onChange={(e) => setPathForm({...pathForm,visibility:e.target.value as 'hidden'|'public'})}><option value="hidden">Oculta</option><option value="public">Pública</option></select></label><label>Acesso<select value={pathForm.accessModel} onChange={(e) => setPathForm({...pathForm,accessModel:e.target.value as AccessModel})}><option value="not_configured">Não configurado</option><option value="free">Gratuita</option><option value="paid">Paga</option><option value="sponsored">Patrocinada</option><option value="included">Incluída no plano</option></select></label>{pathForm.accessModel === 'paid' && <label>Preço de lista (R$)<input type="number" min="0.01" step="0.01" required value={pathForm.price} onChange={(e) => setPathForm({...pathForm,price:e.target.value})} /></label>}</div><label>Resumo<textarea maxLength={320} value={pathForm.shortDescription} onChange={(e) => setPathForm({...pathForm,shortDescription:e.target.value})} /></label><label>Descrição<textarea value={pathForm.description} onChange={(e) => setPathForm({...pathForm,description:e.target.value})} /></label><label>Capa<input value={pathForm.coverRef} onChange={(e) => setPathForm({...pathForm,coverRef:e.target.value})} /></label><div className="coursePicker"><strong>Cursos públicos da trilha</strong>{eligibleCourses.map((course) => <label key={course.courseId}><input type="checkbox" checked={pathForm.courseIds.includes(course.courseId)} onChange={() => toggleCourse(course.courseId)} /> <span>{course.courseTitle}</span></label>)}{!eligibleCourses.length && <p>Nenhum curso público elegível.</p>}</div><label className="portalCheck"><input type="checkbox" checked={pathForm.featured} onChange={(e) => setPathForm({...pathForm,featured:e.target.checked})} /> Destacar trilha</label>{pathForm.visibility === 'public' && !pathForm.courseIds.length && <p className="portalWarning">Trilha pública exige ao menos um curso já público.</p>}<button className="primary">{selectedPath ? 'Salvar trilha' : 'Criar trilha'}</button></form></div></section>
  </div>
}
