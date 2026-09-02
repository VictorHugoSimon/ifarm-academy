import { FormEvent, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import {
  certificateValidationUrl,
  formatWorkload,
  validatePublicCertificate,
  type CertificateRecord,
} from '../services/certificateApi'
import '../styles/public-certificate.css'

const typeLabels: Record<CertificateRecord['certificateType'], string> = {
  free_course: 'Curso livre',
  corporate_training: 'Treinamento corporativo',
  regulatory_training: 'Treinamento regulamentar',
  partner_certification: 'Certificação de parceiro',
}

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR')
}

function certificateNotice(type: CertificateRecord['certificateType']) {
  if (type === 'regulatory_training') {
    return 'A classificação como treinamento regulamentar não substitui a verificação dos requisitos específicos da norma aplicável, incluindo modalidade, carga horária, prática, qualificação dos responsáveis e evidências exigidas.'
  }
  if (type === 'free_course') {
    return 'Este documento comprova a conclusão de curso livre na iFarm Academy e não representa, por si só, habilitação profissional ou reconhecimento regulatório externo.'
  }
  return 'Este documento comprova a conclusão registrada na iFarm Academy conforme os metadados preservados no momento da emissão.'
}

export function PublicCertificateValidationPage() {
  const initial = new URLSearchParams(window.location.search).get('code')?.trim().toUpperCase() ?? ''
  const [input, setInput] = useState(initial)
  const [code, setCode] = useState(initial)
  const [certificate, setCertificate] = useState<CertificateRecord | null>(null)
  const [valid, setValid] = useState(false)
  const [loading, setLoading] = useState(Boolean(initial))
  const [message, setMessage] = useState(initial ? 'Validando certificado...' : 'Informe o código público do certificado.')
  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    if (!code) return
    let cancelled = false
    setLoading(true)
    setMessage('Validando certificado...')
    setCertificate(null)
    setQrDataUrl('')

    void validatePublicCertificate(code)
      .then(async (result) => {
        if (cancelled) return
        setCertificate(result.certificate)
        setValid(result.valid)
        setMessage(result.valid ? 'Certificado válido e localizado.' : 'Certificado localizado, mas não está válido.')
        const url = certificateValidationUrl(result.certificate.publicCode)
        const qr = await QRCode.toDataURL(url, { width: 196, margin: 1, errorCorrectionLevel: 'M' })
        if (!cancelled) setQrDataUrl(qr)
      })
      .catch((error) => {
        if (!cancelled) {
          setValid(false)
          setCertificate(null)
          setMessage(error instanceof Error ? error.message : 'Certificado não encontrado.')
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [code])

  function submit(event: FormEvent) {
    event.preventDefault()
    const normalized = input.trim().toUpperCase()
    if (!normalized) return
    const url = new URL(window.location.href)
    url.searchParams.set('code', normalized)
    window.history.replaceState({}, '', url)
    setCode(normalized)
  }

  return (
    <main className="publicCertificatePage">
      <header className="publicCertificateHeader">
        <div className="publicBrand">
          <strong>iFarm</strong>
          <span>Academy</span>
        </div>
        <div>
          <small>Validação pública</small>
          <h1>Verificar certificado</h1>
          <p>Consulte a autenticidade e os dados acadêmicos preservados na emissão.</p>
        </div>
      </header>

      <form className="certificateSearch" onSubmit={submit}>
        <label htmlFor="certificate-code">Código do certificado</label>
        <div>
          <input id="certificate-code" value={input} onChange={(event) => setInput(event.target.value.toUpperCase())} placeholder="IFA-2026-XXXXXXXXXX" autoComplete="off" />
          <button type="submit">Validar</button>
        </div>
      </form>

      <section className={`validationMessage ${certificate ? (valid ? 'valid' : 'invalid') : ''}`}>
        <strong>{loading ? 'Consultando registro' : certificate ? (valid ? 'Registro confirmado' : 'Registro sem validade ativa') : 'Consulta de certificado'}</strong>
        <span>{message}</span>
      </section>

      {certificate && (
        <article className={`certificateDocument ${valid ? '' : 'revoked'}`}>
          <div className="certificateDocumentTop">
            <div>
              <small>iFarm Academy</small>
              <h2>Certificado de Conclusão</h2>
              <p>{typeLabels[certificate.certificateType]}</p>
            </div>
            <span className="certificateStatus">{valid ? 'VÁLIDO' : 'REVOGADO'}</span>
          </div>

          <div className="certificateStatement">
            <span>Certificamos que</span>
            <strong>{certificate.studentName}</strong>
            <span>concluiu o curso</span>
            <h3>{certificate.courseTitle}</h3>
          </div>

          <div className="certificateFacts">
            <div><span>Carga horária</span><strong>{formatWorkload(certificate.workloadMinutes)}</strong></div>
            <div><span>Conclusão</span><strong>{dateLabel(certificate.completionDate)}</strong></div>
            <div><span>Emissão</span><strong>{dateLabel(certificate.issuedAt)}</strong></div>
            {certificate.finalScore != null && <div><span>Nota final</span><strong>{certificate.finalScore}%</strong></div>}
          </div>

          <div className="certificateResponsible">
            <span>Instrutor / responsável registrado</span>
            <strong>{certificate.instructorLabel || 'Não informado no snapshot'}</strong>
          </div>

          <div className="certificateValidationBlock">
            <div>
              <span>Código único</span>
              <strong>{certificate.publicCode}</strong>
              <small>Snapshot de metadados v{certificate.metadataVersion}</small>
            </div>
            {qrDataUrl && <img src={qrDataUrl} alt={`QR Code para validar ${certificate.publicCode}`} />}
          </div>

          <p className="certificateNotice">{certificateNotice(certificate.certificateType)}</p>
        </article>
      )}

      <footer className="publicCertificateFooter">Validação pública oficial da iFarm Academy.</footer>
    </main>
  )
}
