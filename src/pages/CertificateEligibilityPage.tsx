import { useEffect, useMemo, useState } from 'react'
import { evaluateCertificateEligibility } from '../application/assessmentService'
import {
  certificateStatusLabel,
  certificateValidationUrl,
  certificateValidityLabel,
  formatWorkload,
  loadMyCertificates,
  type CertificateRecord,
} from '../services/certificateApi'
import { loadQuiz } from '../services/quizRepository'
import { calculateProgress, loadStudentProgress } from '../services/studentProgressRepository'
import { issueCertificate, loadAttempts, loadCertificates } from '../services/quizAttemptRepository'
import '../styles/assessment-cert.css'

const STUDENT_ID = 'DEMO-STUDENT-001'
const STUDENT_NAME = 'Aluno Demonstração'
const COURSE_ID = 'C003'
const COURSE_TITLE = 'NR-31 — Segurança no Trabalho na Agricultura'

export function CertificateEligibilityPage() {
  const [serverMode, setServerMode] = useState<'checking' | 'server' | 'local'>('checking')
  const [serverCertificates, setServerCertificates] = useState<CertificateRecord[]>([])
  const [serverMessage, setServerMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    void loadMyCertificates()
      .then((items) => {
        if (cancelled) return
        setServerCertificates(items)
        setServerMode('server')
      })
      .catch(() => { if (!cancelled) setServerMode('local') })
    return () => { cancelled = true }
  }, [])

  if (serverMode === 'checking') {
    return <section className="panel"><h2>Certificação</h2><p>Consultando certificados emitidos...</p></section>
  }

  if (serverMode === 'server') {
    return (
      <div className="certificatePage">
        <div className="pageHeader">
          <div>
            <h1>Certificação</h1>
            <p>Certificados emitidos automaticamente após o atendimento dos requisitos acadêmicos, com situação pública e política de validade preservadas no snapshot.</p>
          </div>
        </div>

        {serverMessage && <div className="certificateReady">{serverMessage}</div>}

        <section className="certificateEligibilityCard">
          <div className="certificateHead">
            <div>
              <small>Meus certificados</small>
              <h2>{serverCertificates.length ? `${serverCertificates.length} certificado(s) localizado(s)` : 'Nenhum certificado emitido'}</h2>
            </div>
          </div>

          {!serverCertificates.length && (
            <div className="certificateReady">
              O certificado será emitido pelo backend quando progresso, avaliação e demais requisitos do curso forem atendidos.
            </div>
          )}

          <div className="certificateServerList">
            {serverCertificates.map((certificate) => {
              const effectiveStatus = certificate.effectiveStatus ?? (certificate.status === 'revoked' ? 'revoked' : 'valid')
              return (
                <article className={`certificateServerItem ${effectiveStatus}`} key={certificate.publicCode}>
                  <div>
                    <small>{certificateStatusLabel(effectiveStatus)}</small>
                    <h3>{certificate.courseTitle}</h3>
                    <p>{formatWorkload(certificate.workloadMinutes)} · concluído em {new Date(certificate.completionDate).toLocaleDateString('pt-BR')}</p>
                    <p>{certificateValidityLabel(certificate)}</p>
                    <strong>{certificate.publicCode}</strong>
                  </div>
                  <div className="certificateServerActions">
                    <a href={certificateValidationUrl(certificate.publicCode)} target="_blank" rel="noopener noreferrer">Validar certificado</a>
                    <button onClick={() => {
                      void navigator.clipboard?.writeText(certificate.publicCode)
                      setServerMessage(`Código ${certificate.publicCode} copiado.`)
                    }}>Copiar código</button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </div>
    )
  }

  return <LocalCertificateDemo />
}

function LocalCertificateDemo() {
  const quiz = useMemo(() => loadQuiz(), [])
  const progress = useMemo(() => loadStudentProgress(), [])
  const attempts = useMemo(() => loadAttempts(quiz.id, STUDENT_ID), [quiz.id])
  const approvedAttempt = attempts.find((item) => item.status === 'approved')
  const baseProgress = calculateProgress(progress)
  const quizLesson = progress.lessons.find((item) => item.lessonId === 'L005')
  const effectiveProgress = approvedAttempt && !quizLesson?.completed
    ? Math.round((progress.lessons.reduce((sum, lesson) => sum + (lesson.lessonId === 'L005' ? 100 : lesson.progressPercent), 0) / progress.lessons.length))
    : baseProgress

  const eligibility = evaluateCertificateEligibility({
    courseProgressPercent: effectiveProgress,
    quizRequired: true,
    attempt: approvedAttempt,
    minimumScore: quiz.minimumScore,
  })

  const [certificate, setCertificate] = useState(() => loadCertificates(STUDENT_ID, COURSE_ID).find((item) => item.status === 'valid') ?? null)

  function issue() {
    if (!eligibility.eligible) return
    const created = issueCertificate({ studentId: STUDENT_ID, studentName: STUDENT_NAME, courseId: COURSE_ID, courseTitle: COURSE_TITLE, finalScore: eligibility.finalScore })
    setCertificate(created)
  }

  return (
    <div className="certificatePage">
      <div className="reviewCard" style={{ marginBottom: 12 }}><strong>Modo local de desenvolvimento</strong><p>O backend não está disponível neste ambiente; a demonstração local permanece ativa.</p></div>
      <div className="pageHeader"><div><h1>Certificação</h1><p>Elegibilidade baseada em conclusão do curso e resultado da avaliação obrigatória.</p></div></div>
      <section className="certificateEligibilityCard">
        <div className="certificateHead"><div><small>{COURSE_TITLE}</small><h2>{eligibility.eligible ? 'Aluno elegível para certificado' : 'Certificado ainda bloqueado'}</h2></div><span>{effectiveProgress}% concluído</span></div>
        <div className="workspaceStatusGrid">
          <div className="workspaceMetric"><span>Progresso</span><strong>{effectiveProgress}%</strong></div>
          <div className="workspaceMetric"><span>Nota mínima</span><strong>{quiz.minimumScore}%</strong></div>
          <div className="workspaceMetric"><span>Nota final</span><strong>{approvedAttempt?.finalPercentage ?? '—'}</strong></div>
          <div className="workspaceMetric"><span>Tentativas</span><strong>{attempts.length}/{quiz.attemptsAllowed}</strong></div>
        </div>
        {!eligibility.eligible && <ul className="certificateReasons">{eligibility.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
        {eligibility.eligible && !certificate && <div className="certificateReady">Todos os critérios acadêmicos foram atendidos. O certificado pode ser emitido.</div>}
        {certificate ? <div className="certificateReady"><strong>Certificado emitido</strong><div className="certificateCode">{certificate.publicCode}</div><small>Emitido em {new Date(certificate.issuedAt).toLocaleString('pt-BR')}</small></div> : <button className="primary" disabled={!eligibility.eligible} onClick={issue}>Emitir certificado</button>}
      </section>
    </div>
  )
}
