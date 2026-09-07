import { useEffect, useState } from 'react'
import { grantCommercialOptIn, loadCommercialRecommendations, type CommercialRecommendation, type CommercialSourceType } from '../services/commercialApi'
import '../styles/commercial.css'

const systemLabels:Record<string,string>={
  ifarm_core:'iFarm Core',ifarm_store:'iFarm Store',ifarm_services:'iFarm Services',ifarm_finance:'iFarm Finance',
  ifarm_insurance:'iFarm Insurance',academy:'iFarm Academy',partner:'Parceiro iFarm',other:'Ecossistema iFarm',
}

export function CommercialRecommendations({sourceType,sourceRef,title='Próximos passos para aplicar este conhecimento'}:{sourceType:CommercialSourceType;sourceRef:string;title?:string}){
  const [items,setItems]=useState<CommercialRecommendation[]>([])
  const [eligible,setEligible]=useState(false)
  const [message,setMessage]=useState('')
  const [busyRule,setBusyRule]=useState('')

  async function load(){
    try{
      const result=await loadCommercialRecommendations(sourceType,sourceRef)
      setEligible(result.eligible)
      setItems(result.data)
    }catch{setEligible(false);setItems([])}
  }

  useEffect(()=>{void load()},[sourceType,sourceRef])

  async function optIn(item:CommercialRecommendation){
    const confirmed=window.confirm(`${item.consentText}\n\nFinalidade: ${item.consentPurpose}\nVersão: ${item.consentVersion}\n\nDeseja autorizar?`)
    if(!confirmed)return
    setBusyRule(item.ruleId);setMessage('Registrando sua autorização...')
    try{
      const result=await grantCommercialOptIn(item.ruleId,item.consentVersion)
      setMessage(result.idempotent?'Seu interesse já estava registrado.':'Interesse registrado. A equipe responsável poderá entrar em contato conforme sua autorização.')
      await load()
    }catch(error){setMessage(error instanceof Error?error.message:'Não foi possível registrar o interesse.')}
    finally{setBusyRule('')}
  }

  if(!eligible||!items.length)return null

  return <section className="commercialRecommendations">
    <header>
      <small>Aplicação prática · opt-in</small>
      <h2>{title}</h2>
      <p>Estas sugestões são relacionadas ao contexto acadêmico concluído. Nenhuma oportunidade comercial é criada sem sua confirmação explícita.</p>
    </header>
    {message&&<div className="commercialNotice">{message}</div>}
    <div className="commercialRecommendationGrid">
      {items.map(item=><article key={item.ruleId} className="commercialOfferCard">
        <span>{systemLabels[item.offerSystem]??item.offerSystem}</span>
        <h3>{item.offerLabel}</h3>
        <p>{item.offerDescription||'Solução disponível no ecossistema iFarm.'}</p>
        <details>
          <summary>Como meu consentimento será usado</summary>
          <p><strong>Finalidade:</strong> {item.consentPurpose}</p>
          <p>{item.consentText}</p>
          <small>Versão do consentimento: {item.consentVersion}</small>
        </details>
        <button className="primary" disabled={item.alreadyOptedIn||busyRule===item.ruleId} onClick={()=>void optIn(item)}>
          {item.alreadyOptedIn?'Interesse já registrado':busyRule===item.ruleId?'Registrando...':item.ctaLabel}
        </button>
      </article>)}
    </div>
  </section>
}
