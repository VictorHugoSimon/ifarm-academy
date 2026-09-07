import { useEffect, useState } from 'react'
import { loadCommercialPrivacy, updateCommercialPrivacy, type CommercialPrivacyOpportunity, type CommercialPrivacyView } from '../services/commercialApi'
import '../styles/commercial.css'

const sourceLabels:Record<string,string>={course_completion:'Conclusão de curso',certificate_issued:'Certificado emitido',event:'Evento',learning_path:'Trilha',plan:'Plano'}

export function CommercialPrivacyPage(){
  const [data,setData]=useState<CommercialPrivacyView|null>(null)
  const [message,setMessage]=useState('Carregando suas preferências...')
  const [busy,setBusy]=useState(false)

  async function load(){
    try{const result=await loadCommercialPrivacy();setData(result);setMessage('')}
    catch(error){setMessage(error instanceof Error?error.message:'Não foi possível carregar as preferências comerciais.')}
  }

  useEffect(()=>{void load()},[])

  async function updateGlobal(action:'suppress_all'|'resume'){
    const blocking=action==='suppress_all'
    const confirmed=window.confirm(blocking
      ? 'Bloquear todos os contatos comerciais? Handoffs ainda não entregues serão cancelados. Seu histórico não será apagado.'
      : 'Reativar a disponibilidade para contatos comerciais? Consentimentos individuais revogados continuarão revogados.')
    if(!confirmed)return
    setBusy(true)
    try{
      const result=await updateCommercialPrivacy({action,reason:blocking?'Preferência alterada pelo próprio usuário':'Contato global reativado pelo próprio usuário'})
      setData(result.data);setMessage(result.idempotent?'A preferência já estava neste estado.':blocking?'Contatos comerciais bloqueados.':'Disponibilidade global reativada.')
    }catch(error){setMessage(error instanceof Error?error.message:'Não foi possível atualizar a preferência.')}
    finally{setBusy(false)}
  }

  async function revoke(item:CommercialPrivacyOpportunity){
    const confirmed=window.confirm(`Revogar o consentimento comercial para "${item.offerLabel||item.interestCode}"?\n\nHandoffs ainda não entregues serão cancelados. O histórico do consentimento original será preservado.`)
    if(!confirmed)return
    setBusy(true)
    try{
      const result=await updateCommercialPrivacy({action:'revoke',opportunityId:item.id,reason:'Consentimento revogado pelo próprio usuário'})
      setData(result.data);setMessage(result.idempotent?'Este consentimento já estava revogado.':'Consentimento revogado.')
    }catch(error){setMessage(error instanceof Error?error.message:'Não foi possível revogar o consentimento.')}
    finally{setBusy(false)}
  }

  async function regrant(item:CommercialPrivacyOpportunity){
    if(!item.regrantAvailable||!item.regrantConsentVersion)return
    const consent=[item.regrantConsentText,item.regrantConsentPurpose?`Finalidade: ${item.regrantConsentPurpose}`:'',`Versão: ${item.regrantConsentVersion}`].filter(Boolean).join('\n\n')
    const confirmed=window.confirm(`${consent}\n\nDeseja reautorizar este contato comercial?`)
    if(!confirmed)return
    setBusy(true)
    try{
      const result=await updateCommercialPrivacy({action:'regrant',opportunityId:item.id,consentVersion:item.regrantConsentVersion,reason:'Consentimento reautorizado pelo próprio usuário'})
      setData(result.data);setMessage(result.idempotent?'Este consentimento já estava ativo.':'Consentimento reautorizado com nova evidência.')
    }catch(error){setMessage(error instanceof Error?error.message:'Não foi possível reautorizar o consentimento.')}
    finally{setBusy(false)}
  }

  return <div className="commercialPrivacyPage">
    <header className="pageHeader"><div><small>Privacidade · LGPD</small><h1>Preferências comerciais</h1><p>Controle contatos comerciais sem apagar o histórico necessário para auditoria. Revogação não altera certificados, cursos, compras ou conversões já registradas.</p></div></header>
    {message&&<div className="commercialNotice">{busy?'Processando... ':''}{message}</div>}

    {data&&<>
      <section className={`panel commercialPrivacyGlobal ${data.globalState}`}>
        <div><small>Preferência global</small><h2>{data.contactAvailable?'Contato comercial disponível':'Contatos comerciais bloqueados'}</h2><p>{data.contactAvailable?'Consentimentos individuais válidos podem ser usados para contato conforme sua finalidade.':'Nenhum novo contato ou handoff comercial pode ser iniciado enquanto este bloqueio estiver ativo.'}</p></div>
        <button className={data.contactAvailable?'commercialDanger':'primary'} disabled={busy} onClick={()=>void updateGlobal(data.contactAvailable?'suppress_all':'resume')}>
          {data.contactAvailable?'Bloquear todos os contatos':'Reativar disponibilidade'}
        </button>
      </section>

      <section className="panel commercialPrivacyList">
        <div><small>Autorizações por interesse</small><h2>Histórico e estado atual</h2><p>Você pode revogar um interesse específico sem bloquear os demais.</p></div>
        {!data.opportunities.length&&<p>Nenhum interesse comercial registrado.</p>}
        {data.opportunities.map(item=><article key={item.id} className={`commercialPrivacyItem ${item.opportunityState}`}>
          <div className="commercialPrivacyItemMain">
            <small>{sourceLabels[item.sourceType]??item.sourceType} · {item.sourceRef}</small>
            <h3>{item.offerLabel||item.interestCode}</h3>
            <p>Consentimento original: {new Date(item.consentRecordedAt).toLocaleString('pt-BR')} · {item.consentVersion||'versão não registrada'}</p>
            <p>Estado: <strong>{item.contactAllowed?'Contato permitido':item.opportunityState==='revoked'?'Consentimento revogado':'Bloqueado pela preferência global'}</strong></p>
            {item.latestOpportunityEvent&&<small>Última alteração desta autorização: {new Date(item.latestOpportunityEvent.createdAt).toLocaleString('pt-BR')} · {item.latestOpportunityEvent.action}</small>}
          </div>
          <div className="commercialPrivacyActions">
            {item.opportunityState==='granted'
              ? <button className="commercialDanger" disabled={busy} onClick={()=>void revoke(item)}>Revogar consentimento</button>
              : item.regrantAvailable
                ? <button className="primary" disabled={busy||!data.contactAvailable} onClick={()=>void regrant(item)}>Reautorizar</button>
                : <button disabled>Novo consentimento necessário</button>}
          </div>
        </article>)}
      </section>
    </>}
  </div>
}
