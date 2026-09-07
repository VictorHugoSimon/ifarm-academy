import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  createCommercialRule,
  loadCommercialHandoffs,
  loadCommercialMetrics,
  loadCommercialOpportunities,
  loadCommercialRules,
  recordCommercialConversionEvidence,
  requestCommercialHandoff,
  updateCommercialOpportunity,
  updateCommercialRule,
  type CommercialHandoff,
  type CommercialMetrics,
  type CommercialOfferSystem,
  type CommercialOpportunity,
  type CommercialRule,
  type CommercialSourceType,
  type CommercialStage,
} from '../services/commercialApi'
import '../styles/commercial.css'

const sourceLabels:Record<CommercialSourceType,string>={course_completion:'Conclusão de curso',certificate_issued:'Certificado emitido',event:'Evento',learning_path:'Trilha',plan:'Plano'}
const systemLabels:Record<CommercialOfferSystem,string>={ifarm_core:'iFarm Core',ifarm_store:'iFarm Store',ifarm_services:'iFarm Services',ifarm_finance:'iFarm Finance',ifarm_insurance:'iFarm Insurance',academy:'Academy',partner:'Parceiro',other:'Outro'}
const stageLabels:Record<CommercialStage,string>={new:'Novo',qualified:'Qualificado',contacted:'Contatado',opportunity:'Oportunidade',converted:'Convertido',discarded:'Descartado'}
const stages=Object.keys(stageLabels) as CommercialStage[]

function formatPercent(value:number|null){return value==null?'—':`${value}%`}
function formatMoney(cents:number,currency:string){try{return new Intl.NumberFormat('pt-BR',{style:'currency',currency}).format(cents/100)}catch{return `${currency} ${(cents/100).toFixed(2)}`}}

export function CommercialEnginePage(){
  const [rules,setRules]=useState<CommercialRule[]>([])
  const [opportunities,setOpportunities]=useState<CommercialOpportunity[]>([])
  const [handoffs,setHandoffs]=useState<CommercialHandoff[]>([])
  const [serverMetrics,setServerMetrics]=useState<CommercialMetrics|null>(null)
  const [stageFilter,setStageFilter]=useState<''|CommercialStage>('')
  const [message,setMessage]=useState('Carregando motor comercial...')
  const [busy,setBusy]=useState(false)
  const [form,setForm]=useState({sourceType:'certificate_issued' as CommercialSourceType,sourceRef:'',interestCode:'irrigation',offerSystem:'ifarm_services' as CommercialOfferSystem,offerRef:'',offerLabel:'',offerDescription:'',ctaLabel:'Quero saber mais',consentPurpose:'Registrar interesse voluntário e permitir contato da iFarm sobre a solução selecionada.',consentText:'Autorizo a iFarm a registrar meu interesse nesta solução e entrar em contato para apresentar informações comerciais relacionadas.',consentVersion:'v1',priority:'100'})

  async function load(){
    try{
      const [ruleItems,opportunityItems,handoffItems,metrics]=await Promise.all([
        loadCommercialRules(),loadCommercialOpportunities(stageFilter?{stage:stageFilter}:undefined),loadCommercialHandoffs(),loadCommercialMetrics(),
      ])
      setRules(ruleItems);setOpportunities(opportunityItems);setHandoffs(handoffItems);setServerMetrics(metrics)
      setMessage('Motor comercial conectado. Handoffs ficam na outbox até um adapter real confirmar a entrega.')
    }catch(error){setMessage(error instanceof Error?error.message:'Não foi possível carregar o motor comercial.')}
  }
  useEffect(()=>{void load()},[stageFilter])

  const metrics=useMemo(()=>({activeRules:rules.filter(item=>item.status==='active').length,newItems:opportunities.filter(item=>item.stage==='new').length,pipeline:opportunities.filter(item=>!['converted','discarded'].includes(item.stage)).length,converted:opportunities.filter(item=>item.stage==='converted').length}),[rules,opportunities])
  const brlValue=serverMetrics?.attributedCommercialValue.totalsByCurrency.find(item=>item.currency==='BRL')
  const openHandoffByOpportunity=useMemo(()=>new Set(handoffs.filter(item=>['pending','processing','failed'].includes(item.status)).map(item=>item.opportunityId)),[handoffs])

  async function submitRule(event:FormEvent){event.preventDefault();setBusy(true);try{await createCommercialRule({sourceType:form.sourceType,sourceRef:form.sourceRef.trim(),interestCode:form.interestCode.trim(),offerSystem:form.offerSystem,offerRef:form.offerRef.trim(),offerLabel:form.offerLabel.trim(),offerDescription:form.offerDescription.trim(),ctaLabel:form.ctaLabel.trim(),consentPurpose:form.consentPurpose.trim(),consentText:form.consentText.trim(),consentVersion:form.consentVersion.trim(),priority:Number(form.priority||100),status:'draft'});setForm({...form,sourceRef:'',offerRef:'',offerLabel:'',offerDescription:'',consentVersion:'v1'});setMessage('Regra criada em rascunho. Revise e ative quando estiver pronta.');await load()}catch(error){setMessage(error instanceof Error?error.message:'Não foi possível criar a regra.')}finally{setBusy(false)}}
  async function changeRuleStatus(rule:CommercialRule,status:'active'|'archived'){setBusy(true);try{await updateCommercialRule(rule.id,{status});setMessage(status==='active'?'Regra ativada.':'Regra arquivada e preservada no histórico.');await load()}catch(error){setMessage(error instanceof Error?error.message:'Não foi possível atualizar a regra.')}finally{setBusy(false)}}
  async function moveOpportunity(item:CommercialOpportunity,stage:CommercialStage){if(stage===item.stage)return;let conversionRef:string|undefined;if(stage==='converted'){conversionRef=window.prompt('Informe a referência real da conversão (pedido, contrato, CRM etc.):')?.trim()||undefined;if(!conversionRef)return}setBusy(true);try{await updateCommercialOpportunity(item.id,{stage,conversionRef});setMessage('Pipeline comercial atualizado e auditado.');await load()}catch(error){setMessage(error instanceof Error?error.message:'Não foi possível atualizar a oportunidade.')}finally{setBusy(false)}}
  async function assign(item:CommercialOpportunity){const assignedToUserId=window.prompt('ID do responsável comercial. Deixe vazio para remover a atribuição:',item.assignedToUserId??'');if(assignedToUserId===null)return;setBusy(true);try{await updateCommercialOpportunity(item.id,{assignedToUserId:assignedToUserId.trim()||null});setMessage('Responsável atualizado.');await load()}catch(error){setMessage(error instanceof Error?error.message:'Não foi possível atribuir a oportunidade.')}finally{setBusy(false)}}
  async function prepareHandoff(item:CommercialOpportunity){setBusy(true);try{const result=await requestCommercialHandoff(item.id,'ifarm_core');setMessage(result.idempotent?'Já existe um handoff aberto para iFarm Core.':'Handoff preparado na outbox. Nenhum envio externo foi executado.');await load()}catch(error){setMessage(error instanceof Error?error.message:'Não foi possível preparar o handoff.')}finally{setBusy(false)}}
  async function addConversionEvidence(item:CommercialOpportunity){if(item.stage!=='converted')return;const evidenceRef=window.prompt('Referência da evidência (pedido, contrato, pagamento ou CRM):',item.conversionRef??'')?.trim();if(!evidenceRef)return;const valueText=window.prompt('Valor comercial atribuído em R$ (opcional). Não será tratado como receita recebida:','')?.trim();if(valueText===undefined)return;let attributedValueCents:number|null=null;if(valueText){const normalized=Number(valueText.replace(',','.'));if(!Number.isFinite(normalized)||normalized<0){setMessage('Valor comercial inválido.');return}attributedValueCents=Math.round(normalized*100)}setBusy(true);try{await recordCommercialConversionEvidence({opportunityId:item.id,evidenceSystem:'order',evidenceRef,attributedValueCents,currency:'BRL'});setMessage('Evidência de conversão registrada. O valor é atribuição comercial, não faturamento contábil.');await load()}catch(error){setMessage(error instanceof Error?error.message:'Não foi possível registrar a evidência.')}finally{setBusy(false)}}

  return <div className="commercialEnginePage">
    <header className="pageHeader commercialHeader"><div><small>iFarm Academy · Motor comercial</small><h1>Educação que gera oportunidades consentidas</h1><p>Recomendações, pipeline, handoff desacoplado e evidência de conversão sem confundir oportunidade com receita contábil.</p></div></header>
    <div className="commercialNotice">{busy?'Processando... ':''}{message}</div>

    <section className="commercialMetrics">
      <article><span>Regras ativas</span><strong>{metrics.activeRules}</strong></article>
      <article><span>Novos interesses</span><strong>{metrics.newItems}</strong></article>
      <article><span>Conversão da coorte</span><strong>{formatPercent(serverMetrics?.funnel.cohortConversionRate??null)}</strong></article>
      <article><span>Handoffs abertos</span><strong>{serverMetrics?.handoffs.open??0}</strong></article>
    </section>
    <section className="commercialMetrics commercialMetricsSecondary">
      <article><span>Convertidos no período</span><strong>{serverMetrics?.funnel.conversionsConfirmedInPeriod??metrics.converted}</strong></article>
      <article><span>Evidências de conversão</span><strong>{serverMetrics?.attributedCommercialValue.evidenceCount??0}</strong></article>
      <article><span>Valor atribuído · BRL</span><strong>{brlValue?formatMoney(brlValue.confirmedAttributedValueCents,'BRL'):'—'}</strong></article>
      <article><span>Handoffs entregues no período</span><strong>{serverMetrics?.handoffs.deliveredInPeriod??0}</strong></article>
    </section>
    {serverMetrics&&<div className="commercialAccountingNote">{serverMetrics.accountingDisclaimer}</div>}

    <div className="commercialAdminGrid">
      <form className="panel commercialRuleForm" onSubmit={submitRule}>
        <div><small>Governança</small><h2>Nova regra de recomendação</h2><p>A regra nasce em rascunho. Ativar apenas habilita a sugestão para usuários elegíveis.</p></div>
        <div className="commercialFormRow"><label>Origem<select value={form.sourceType} onChange={e=>setForm({...form,sourceType:e.target.value as CommercialSourceType})}>{Object.entries(sourceLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>ID da origem<input required value={form.sourceRef} onChange={e=>setForm({...form,sourceRef:e.target.value})} placeholder="course/event/path/plan id"/></label></div>
        <div className="commercialFormRow"><label>Tema/interesse<input required value={form.interestCode} onChange={e=>setForm({...form,interestCode:e.target.value})}/></label><label>Sistema da oferta<select value={form.offerSystem} onChange={e=>setForm({...form,offerSystem:e.target.value as CommercialOfferSystem})}>{Object.entries(systemLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
        <label>Referência externa da oferta<input required value={form.offerRef} onChange={e=>setForm({...form,offerRef:e.target.value})}/></label><label>Título da oferta<input required value={form.offerLabel} onChange={e=>setForm({...form,offerLabel:e.target.value})}/></label><label>Descrição<textarea value={form.offerDescription} onChange={e=>setForm({...form,offerDescription:e.target.value})}/></label>
        <div className="commercialFormRow"><label>CTA<input required value={form.ctaLabel} onChange={e=>setForm({...form,ctaLabel:e.target.value})}/></label><label>Prioridade<input type="number" min="0" value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}/></label></div>
        <label>Finalidade do consentimento<textarea required value={form.consentPurpose} onChange={e=>setForm({...form,consentPurpose:e.target.value})}/></label><label>Texto mostrado ao usuário<textarea required value={form.consentText} onChange={e=>setForm({...form,consentText:e.target.value})}/></label><label>Versão do consentimento<input required value={form.consentVersion} onChange={e=>setForm({...form,consentVersion:e.target.value})}/></label><button className="primary" disabled={busy}>Criar regra em rascunho</button>
      </form>
      <section className="panel commercialRulesList"><div><small>Regras</small><h2>Ofertas configuradas</h2></div>{rules.map(rule=><article key={rule.id}><header><div><small>{sourceLabels[rule.sourceType]} · {rule.sourceRef}</small><h3>{rule.offerLabel}</h3></div><span className={`commercialStatus ${rule.status}`}>{rule.status}</span></header><p>{systemLabels[rule.offerSystem]} · {rule.interestCode} · consentimento {rule.consentVersion}</p><small>{rule.consentPurpose}</small><footer>{rule.status==='draft'&&<button disabled={busy} onClick={()=>void changeRuleStatus(rule,'active')}>Ativar</button>}{rule.status!=='archived'&&<button disabled={busy} onClick={()=>void changeRuleStatus(rule,'archived')}>Arquivar</button>}</footer></article>)}{!rules.length&&<p>Nenhuma regra comercial configurada.</p>}</section>
    </div>

    <section className="panel commercialPipeline">
      <header className="commercialPipelineHeader"><div><small>Pipeline</small><h2>Oportunidades com consentimento registrado</h2></div><label>Etapa<select value={stageFilter} onChange={e=>setStageFilter(e.target.value as ''|CommercialStage)}><option value="">Todas</option>{stages.map(stage=><option key={stage} value={stage}>{stageLabels[stage]}</option>)}</select></label></header>
      <div className="commercialTableWrap"><table><thead><tr><th>Usuário</th><th>Origem</th><th>Oferta</th><th>Responsável</th><th>Etapa</th><th>Integração</th></tr></thead><tbody>{opportunities.map(item=><tr key={item.id}><td><strong>{item.userId}</strong><small>{new Date(item.consentRecordedAt).toLocaleString('pt-BR')}</small></td><td>{sourceLabels[item.sourceType]}<small>{item.sourceRef}</small></td><td>{item.offerLabel||item.interestCode}<small>{item.offerSystem?systemLabels[item.offerSystem]:item.interestCode}</small></td><td><button onClick={()=>void assign(item)}>{item.assignedToUserId||'Atribuir'}</button></td><td><select value={item.stage} disabled={busy||item.stage==='converted'} onChange={e=>void moveOpportunity(item,e.target.value as CommercialStage)}>{stages.map(stage=><option key={stage} value={stage}>{stageLabels[stage]}</option>)}</select>{item.conversionRef&&<small>{item.conversionRef}</small>}</td><td><div className="commercialRowActions">{['qualified','contacted','opportunity','converted'].includes(item.stage)&&<button disabled={busy||openHandoffByOpportunity.has(item.id)} onClick={()=>void prepareHandoff(item)}>{openHandoffByOpportunity.has(item.id)?'Handoff na fila':'Preparar handoff'}</button>}{item.stage==='converted'&&<button disabled={busy} onClick={()=>void addConversionEvidence(item)}>Evidência de conversão</button>}</div></td></tr>)}</tbody></table></div>{!opportunities.length&&<p>Nenhuma oportunidade encontrada para o filtro atual.</p>}
    </section>

    <section className="panel commercialPipeline"><header className="commercialPipelineHeader"><div><small>Outbox</small><h2>Handoffs preparados</h2><p>Estado local da integração. `delivered` só deve ser confirmado pelo adapter quando existir contrato real com o destino.</p></div></header><div className="commercialTableWrap"><table><thead><tr><th>Oportunidade</th><th>Destino</th><th>Status</th><th>Tentativas</th><th>Referência de entrega</th></tr></thead><tbody>{handoffs.slice(0,30).map(item=><tr key={item.id}><td>{item.opportunityId}</td><td>{item.destinationSystem}</td><td>{item.status}{item.lastErrorCode&&<small>{item.lastErrorCode}</small>}</td><td>{item.attempts}</td><td>{item.deliveryReference||'—'}</td></tr>)}</tbody></table></div>{!handoffs.length&&<p>Nenhum handoff preparado.</p>}</section>
  </div>
}
