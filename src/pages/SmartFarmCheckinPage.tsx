import { useMemo, useState } from 'react'
import { submitSmartFarmQr } from '../services/smartFarmApi'
import '../styles/smart-farm.css'

function resultText(data: Record<string, unknown>) {
  const purpose = String(data.purpose ?? '')
  if (purpose === 'checkin') return `Entrada confirmada em ${String(data.eventTitle ?? 'Smart Farm Experience')}.`
  if (purpose === 'checkout') return `Saída confirmada em ${String(data.eventTitle ?? 'Smart Farm Experience')}.`
  if (purpose === 'station') return `Atividade registrada: ${String(data.agendaTitle ?? 'estação prática')}.`
  return 'Registro concluído.'
}

export function SmartFarmCheckinPage() {
  const initialToken = useMemo(() => new URLSearchParams(window.location.search).get('token')?.trim() ?? '', [])
  const [token, setToken] = useState(initialToken)
  const [status, setStatus] = useState<'idle'|'submitting'|'success'|'error'>('idle')
  const [message, setMessage] = useState(initialToken ? 'Confira o QR e confirme para registrar a ação.' : 'Informe o token exibido pela organização.')
  const [result, setResult] = useState<Record<string, unknown> | null>(null)

  async function confirm() {
    if (!token.trim()) { setStatus('error'); setMessage('Token obrigatório.'); return }
    setStatus('submitting'); setMessage('Validando inscrição e QR...'); setResult(null)
    try {
      const response = await submitSmartFarmQr(token.trim())
      setResult(response.data)
      setStatus('success')
      setMessage(resultText(response.data))
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível registrar a ação.')
    }
  }

  return (
    <main className="smartFarmCheckinPage">
      <section className="smartFarmCheckinCard">
        <div className="smartFarmPublicBrand"><strong>iFarm</strong><span>Academy</span></div>
        <small>Smart Farm Experience</small>
        <h1>Confirmar presença ou atividade</h1>
        <p>O QR não executa nenhuma ação sozinho. Confirme abaixo usando sua sessão autenticada da iFarm Academy.</p>

        <label>Token do QR<input value={token} onChange={(event) => setToken(event.target.value.trim())} autoComplete="off" /></label>
        <button className="primary" disabled={status === 'submitting' || !token.trim()} onClick={() => void confirm()}>{status === 'submitting' ? 'Confirmando...' : 'Confirmar'}</button>

        <div className={`smartFarmCheckinStatus ${status}`}>
          <strong>{status === 'success' ? 'Registro confirmado' : status === 'error' ? 'Não foi possível confirmar' : 'Aguardando confirmação'}</strong>
          <span>{message}</span>
        </div>

        {result && <div className="smartFarmCheckinResult">
          {result.eventTitle && <div><span>Evento</span><strong>{String(result.eventTitle)}</strong></div>}
          {result.agendaTitle && <div><span>Atividade</span><strong>{String(result.agendaTitle)}</strong></div>}
          {result.checkinAt && <div><span>Entrada</span><strong>{new Date(String(result.checkinAt)).toLocaleString('pt-BR')}</strong></div>}
          {result.checkoutAt && <div><span>Saída</span><strong>{new Date(String(result.checkoutAt)).toLocaleString('pt-BR')}</strong></div>}
          {result.evidenceStatus && <div><span>Evidência</span><strong>{String(result.evidenceStatus)}</strong></div>}
        </div>}

        <div className="smartFarmPrivacyNotice">O token é validado no servidor e comparado pelo hash. A Academy não usa a leitura do QR para criar lead comercial. Interesse em produtos ou serviços exige consentimento separado.</div>
      </section>
    </main>
  )
}
