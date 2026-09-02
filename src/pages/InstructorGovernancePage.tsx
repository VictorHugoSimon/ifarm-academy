import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  assignCourseInstructor,
  createInstructor,
  createInstructorQualification,
  inactivateCourseInstructorRole,
  loadCourseInstructorRoles,
  loadCourseSummaries,
  loadInstructorQualifications,
  loadInstructors,
  verifyInstructorQualification,
  type CourseInstructorRole,
  type CourseInstructorRoleRecord,
  type CourseSummaryRecord,
  type InstructorQualificationRecord,
  type InstructorRecord,
  type QualificationType,
} from '../services/instructorApi'
import '../styles/instructors.css'

const roleLabel: Record<CourseInstructorRole, string> = {
  author: 'Autor', instructor: 'Instrutor', reviewer: 'Revisor', technical_responsible: 'Responsável técnico',
}

const qualificationTypeLabel: Record<QualificationType, string> = {
  degree: 'Graduação', technical: 'Formação técnica', council_registration: 'Registro em conselho',
  certification: 'Certificação', experience: 'Experiência', other: 'Outro',
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR')
}

export function InstructorGovernancePage() {
  const [instructors, setInstructors] = useState<InstructorRecord[]>([])
  const [selectedInstructorId, setSelectedInstructorId] = useState('')
  const [qualifications, setQualifications] = useState<InstructorQualificationRecord[]>([])
  const [courses, setCourses] = useState<CourseSummaryRecord[]>([])
  const [roles, setRoles] = useState<CourseInstructorRoleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState('')

  const [instructorForm, setInstructorForm] = useState({ userId: '', displayName: '', bio: '' })
  const [qualificationForm, setQualificationForm] = useState({
    qualificationType: 'technical' as QualificationType, title: '', institution: '', field: '', councilName: '',
    registrationNumber: '', registrationRegion: '', issuedAt: '', expiresAt: '', evidenceRef: '',
  })
  const [roleForm, setRoleForm] = useState({
    courseId: '', role: 'instructor' as CourseInstructorRole, qualificationId: '', suitabilityConfirmed: false, suitabilityNote: '',
  })

  const selectedInstructor = useMemo(() => instructors.find((item) => item.id === selectedInstructorId) ?? null, [instructors, selectedInstructorId])
  const verifiedQualifications = useMemo(() => qualifications.filter((item) => item.verificationStatus === 'verified'), [qualifications])

  async function refreshInstructors(preferredId?: string) {
    const items = await loadInstructors()
    setInstructors(items)
    const next = preferredId && items.some((item) => item.id === preferredId)
      ? preferredId
      : selectedInstructorId && items.some((item) => item.id === selectedInstructorId)
        ? selectedInstructorId
        : items[0]?.id ?? ''
    setSelectedInstructorId(next)
    return next
  }

  async function refreshSelected(instructorId: string) {
    if (!instructorId) {
      setQualifications([])
      return
    }
    setQualifications(await loadInstructorQualifications(instructorId))
  }

  async function bootstrap() {
    setLoading(true)
    try {
      const [courseItems, roleItems] = await Promise.all([loadCourseSummaries(), loadCourseInstructorRoles()])
      setCourses(courseItems)
      setRoles(roleItems)
      setRoleForm((current) => ({ ...current, courseId: current.courseId || courseItems[0]?.id || '' }))
      await refreshInstructors()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar a governança de instrutores.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void bootstrap() }, [])
  useEffect(() => {
    if (!selectedInstructorId) return
    void refreshSelected(selectedInstructorId).catch((error) => setMessage(error instanceof Error ? error.message : 'Não foi possível carregar qualificações.'))
  }, [selectedInstructorId])

  async function handleCreateInstructor(event: FormEvent) {
    event.preventDefault()
    setMessage('Cadastrando instrutor...')
    try {
      const result = await createInstructor({ userId: instructorForm.userId.trim(), displayName: instructorForm.displayName.trim(), bio: instructorForm.bio.trim() })
      setInstructorForm({ userId: '', displayName: '', bio: '' })
      await refreshInstructors(result.data.id)
      setMessage(result.idempotent ? 'Este usuário iFarm já era instrutor ativo.' : 'Instrutor cadastrado usando a identidade existente do iFarm.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível cadastrar o instrutor.') }
  }

  async function handleCreateQualification(event: FormEvent) {
    event.preventDefault()
    if (!selectedInstructorId) return
    setMessage('Registrando qualificação declarada...')
    try {
      await createInstructorQualification({
        instructorId: selectedInstructorId,
        qualificationType: qualificationForm.qualificationType,
        title: qualificationForm.title.trim(), institution: qualificationForm.institution.trim() || undefined,
        field: qualificationForm.field.trim() || undefined, councilName: qualificationForm.councilName.trim() || undefined,
        registrationNumber: qualificationForm.registrationNumber.trim() || undefined,
        registrationRegion: qualificationForm.registrationRegion.trim() || undefined,
        issuedAt: qualificationForm.issuedAt || undefined, expiresAt: qualificationForm.expiresAt || undefined,
        evidenceRef: qualificationForm.evidenceRef.trim() || undefined,
      })
      setQualificationForm({ qualificationType: 'technical', title: '', institution: '', field: '', councilName: '', registrationNumber: '', registrationRegion: '', issuedAt: '', expiresAt: '', evidenceRef: '' })
      await Promise.all([refreshSelected(selectedInstructorId), refreshInstructors(selectedInstructorId)])
      setMessage('Qualificação registrada como declarada. Ela ainda não representa verificação ou habilitação automática.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível registrar a qualificação.') }
  }

  async function handleVerify(qualificationId: string, verificationStatus: 'verified' | 'rejected') {
    setBusyId(qualificationId)
    try {
      await verifyInstructorQualification({ qualificationId, verificationStatus, verificationNote: verificationStatus === 'verified' ? 'Documentação verificada administrativamente na Academy.' : 'Qualificação rejeitada na conferência administrativa.' })
      await Promise.all([refreshSelected(selectedInstructorId), refreshInstructors(selectedInstructorId)])
      setMessage(verificationStatus === 'verified' ? 'Qualificação marcada como verificada. A adequação legal ao treinamento ainda deve ser confirmada ao atribuir responsabilidade técnica.' : 'Qualificação rejeitada.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a verificação.') }
    finally { setBusyId('') }
  }

  async function handleAssignRole(event: FormEvent) {
    event.preventDefault()
    if (!selectedInstructorId || !roleForm.courseId) return
    setMessage('Atribuindo papel ao curso...')
    try {
      const result = await assignCourseInstructor({
        courseId: roleForm.courseId,
        instructorId: selectedInstructorId,
        role: roleForm.role,
        qualificationId: roleForm.qualificationId || undefined,
        suitabilityConfirmed: roleForm.role === 'technical_responsible' ? roleForm.suitabilityConfirmed : false,
        suitabilityNote: roleForm.role === 'technical_responsible' ? roleForm.suitabilityNote.trim() : undefined,
      })
      setRoles(await loadCourseInstructorRoles())
      setRoleForm((current) => ({ ...current, qualificationId: '', suitabilityConfirmed: false, suitabilityNote: '' }))
      setMessage(result.idempotent ? 'Este papel já estava ativo.' : roleForm.role === 'technical_responsible' ? 'Responsabilidade técnica registrada com confirmação humana e trilha de auditoria.' : 'Papel acadêmico atribuído.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível atribuir o papel.') }
  }

  async function handleInactivateRole(roleId: string) {
    if (!window.confirm('Inativar este vínculo com o curso? O histórico será preservado.')) return
    setBusyId(roleId)
    try {
      await inactivateCourseInstructorRole(roleId)
      setRoles(await loadCourseInstructorRoles())
      setMessage('Vínculo inativado; histórico preservado.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível inativar o vínculo.') }
    finally { setBusyId('') }
  }

  return (
    <div className="instructorPage">
      <div className="pageHeader"><div>
        <h1>Instrutores & responsabilidade técnica</h1>
        <p>Identidade iFarm, qualificações verificáveis, revisão técnica e responsabilidades por curso.</p>
        <small>{loading ? 'Carregando governança técnica...' : 'Governança conectada ao backend da Academy'}</small>
        {message && <small className="instructorMessage">{message}</small>}
      </div></div>

      <section className="instructorMetrics">
        <article><span>Instrutores ativos</span><strong>{instructors.filter((item) => item.status === 'active').length}</strong></article>
        <article><span>Qualificações verificadas</span><strong>{instructors.reduce((sum, item) => sum + item.verifiedQualifications, 0)}</strong></article>
        <article><span>Papéis ativos em cursos</span><strong>{roles.filter((item) => item.status === 'active').length}</strong></article>
        <article><span>Responsáveis técnicos</span><strong>{roles.filter((item) => item.status === 'active' && item.role === 'technical_responsible').length}</strong></article>
      </section>

      <div className="instructorGrid">
        <form className="panel enterpriseForm" onSubmit={handleCreateInstructor}>
          <div className="panelTitle"><h2>Novo instrutor</h2></div>
          <label>iFarm User ID<input required value={instructorForm.userId} onChange={(e) => setInstructorForm({ ...instructorForm, userId: e.target.value })} placeholder="Identidade já existente no iFarm" /></label>
          <label>Nome<input required value={instructorForm.displayName} onChange={(e) => setInstructorForm({ ...instructorForm, displayName: e.target.value })} /></label>
          <label>Bio<textarea value={instructorForm.bio} onChange={(e) => setInstructorForm({ ...instructorForm, bio: e.target.value })} /></label>
          <button className="primary" type="submit">Cadastrar instrutor</button>
        </form>

        <section className="panel instructorSelector">
          <div className="panelTitle"><h2>Instrutor selecionado</h2></div>
          <select value={selectedInstructorId} onChange={(e) => setSelectedInstructorId(e.target.value)}>
            {!instructors.length && <option value="">Nenhum instrutor</option>}
            {instructors.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
          </select>
          {selectedInstructor && <div className="instructorIdentity"><strong>{selectedInstructor.displayName}</strong><small>{selectedInstructor.userId}</small><span>{selectedInstructor.verifiedQualifications} qualificações verificadas · {selectedInstructor.activeCourseRoles} papéis ativos</span></div>}
        </section>
      </div>

      {selectedInstructor && <div className="instructorGrid">
        <form className="panel enterpriseForm" onSubmit={handleCreateQualification}>
          <div className="panelTitle"><h2>Registrar qualificação</h2></div>
          <label>Tipo<select value={qualificationForm.qualificationType} onChange={(e) => setQualificationForm({ ...qualificationForm, qualificationType: e.target.value as QualificationType })}>{Object.entries(qualificationTypeLabel).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Título<input required value={qualificationForm.title} onChange={(e) => setQualificationForm({ ...qualificationForm, title: e.target.value })} /></label>
          <label>Instituição<input value={qualificationForm.institution} onChange={(e) => setQualificationForm({ ...qualificationForm, institution: e.target.value })} /></label>
          <label>Área / especialidade<input value={qualificationForm.field} onChange={(e) => setQualificationForm({ ...qualificationForm, field: e.target.value })} /></label>
          <div className="instructorFormRow"><label>Conselho<input value={qualificationForm.councilName} onChange={(e) => setQualificationForm({ ...qualificationForm, councilName: e.target.value })} /></label><label>Registro<input value={qualificationForm.registrationNumber} onChange={(e) => setQualificationForm({ ...qualificationForm, registrationNumber: e.target.value })} /></label></div>
          <div className="instructorFormRow"><label>Emissão<input type="date" value={qualificationForm.issuedAt} onChange={(e) => setQualificationForm({ ...qualificationForm, issuedAt: e.target.value })} /></label><label>Validade<input type="date" value={qualificationForm.expiresAt} onChange={(e) => setQualificationForm({ ...qualificationForm, expiresAt: e.target.value })} /></label></div>
          <label>Referência de evidência<input value={qualificationForm.evidenceRef} onChange={(e) => setQualificationForm({ ...qualificationForm, evidenceRef: e.target.value })} placeholder="Documento/ID a ser integrado ao storage" /></label>
          <button className="primary" type="submit">Registrar como declarada</button>
        </form>

        <section className="panel qualificationList">
          <div className="panelTitle"><h2>Qualificações</h2><span>{qualifications.length} registros</span></div>
          {qualifications.map((item) => <article key={item.id}>
            <div><strong>{item.title}</strong><small>{qualificationTypeLabel[item.qualificationType]} · {item.institution || 'Instituição não informada'}</small>{item.councilName && <small>{item.councilName} {item.registrationNumber || ''}</small>}</div>
            <div><span className={`qualificationStatus ${item.verificationStatus}`}>{item.verificationStatus}</span><small>Validade: {formatDate(item.expiresAt)}</small></div>
            <div className="qualificationActions">{item.verificationStatus === 'declared' && <><button className="primary" disabled={busyId === item.id} onClick={() => void handleVerify(item.id, 'verified')}>Verificar</button><button disabled={busyId === item.id} onClick={() => void handleVerify(item.id, 'rejected')}>Rejeitar</button></>}</div>
          </article>)}
          {!qualifications.length && <div className="enterpriseEmpty">Nenhuma qualificação registrada.</div>}
        </section>
      </div>}

      {selectedInstructor && <section className="panel technicalAssignmentPanel">
        <div className="panelTitle"><h2>Papéis e responsabilidade no curso</h2></div>
        <div className="technicalAssignmentGrid">
          <form className="enterpriseForm" onSubmit={handleAssignRole}>
            <label>Curso<select required value={roleForm.courseId} onChange={(e) => setRoleForm({ ...roleForm, courseId: e.target.value })}><option value="">Selecione</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title} · {course.status}</option>)}</select></label>
            <label>Papel<select value={roleForm.role} onChange={(e) => setRoleForm({ ...roleForm, role: e.target.value as CourseInstructorRole, qualificationId: '', suitabilityConfirmed: false, suitabilityNote: '' })}>{Object.entries(roleLabel).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {roleForm.role === 'technical_responsible' && <>
              <label>Qualificação verificada<select required value={roleForm.qualificationId} onChange={(e) => setRoleForm({ ...roleForm, qualificationId: e.target.value })}><option value="">Selecione</option>{verifiedQualifications.map((item) => <option key={item.id} value={item.id}>{item.title}{item.expiresAt ? ` · válida até ${formatDate(item.expiresAt)}` : ''}</option>)}</select></label>
              <label className="enterpriseCheck"><input type="checkbox" checked={roleForm.suitabilityConfirmed} onChange={(e) => setRoleForm({ ...roleForm, suitabilityConfirmed: e.target.checked })} /> Confirmo humanamente a adequação desta qualificação ao papel neste curso.</label>
              <label>Justificativa<textarea required value={roleForm.suitabilityNote} onChange={(e) => setRoleForm({ ...roleForm, suitabilityNote: e.target.value })} placeholder="Registrar o racional da decisão. A Academy não infere habilitação legal." /></label>
            </>}
            <button className="primary" type="submit" disabled={roleForm.role === 'technical_responsible' && (!roleForm.qualificationId || !roleForm.suitabilityConfirmed || !roleForm.suitabilityNote.trim())}>Atribuir papel</button>
          </form>
          <div className="technicalNotice"><strong>Governança</strong><p>“Verificada” significa que a evidência cadastrada foi conferida administrativamente. A suficiência técnica, legal ou regulatória para ministrar ou responder por um treinamento continua sendo uma decisão humana e deve observar a norma aplicável.</p></div>
        </div>
      </section>}

      <section className="panel courseRoleList">
        <div className="panelTitle"><h2>Vínculos registrados</h2><span>{roles.filter((item) => item.status === 'active').length} ativos</span></div>
        {roles.map((item) => <article key={item.id} className={item.status === 'inactive' ? 'inactive' : ''}>
          <div><strong>{item.courseTitle}</strong><small>{item.displayName} · {roleLabel[item.role]}</small></div>
          <div><span>{item.qualificationTitle || 'Sem qualificação vinculada'}</span>{item.suitabilityConfirmed && <small>Confirmado em {formatDate(item.suitabilityConfirmedAt)}</small>}</div>
          <div>{item.status === 'active' ? <button disabled={busyId === item.id} onClick={() => void handleInactivateRole(item.id)}>Inativar</button> : <span>Inativo</span>}</div>
        </article>)}
      </section>
    </div>
  )
}
