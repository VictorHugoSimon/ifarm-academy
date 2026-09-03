import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  loadWhiteLabelCatalog,
  loadWhiteLabelDomains,
  loadWhiteLabelPermissions,
  loadWhiteLabelSettings,
  requestWhiteLabelDomain,
  saveWhiteLabelCatalog,
  saveWhiteLabelSettings,
  updateWhiteLabelDomain,
  type WhiteLabelBrand,
  type WhiteLabelCatalogCourse,
  type WhiteLabelDomain,
  type WhiteLabelPermissions,
} from '../services/whiteLabelApi'
import '../styles/white-label.css'

const defaultBrand: WhiteLabelBrand = {
  brandName: 'iFarm', academyName: 'iFarm Academy', primaryColor: '#004E3B',
  secondaryColor: '#087A51', accentColor: '#00825B', logoRef: null,
  certificateHeading: null, catalogMode: 'all_tenant_courses', whiteLabelConfigured: false,
}

const domainLabel: Record<WhiteLabelDomain['status'], string> = {
  pending: 'Pendente', verified: 'Verificado', disabled: 'Desativado',
}

export function WhiteLabelPage() {
  const [permissions, setPermissions] = useState<WhiteLabelPermissions>({ canConfigure: false, canVerifyDomains: false })
  const [brand, setBrand] = useState<WhiteLabelBrand>(defaultBrand)
  const [domains, setDomains] = useState<WhiteLabelDomain[]>([])
  const [catalog, setCatalog] = useState<WhiteLabelCatalogCourse[]>([])
  const [hostname, setHostname] = useState('')
  const [verificationRefs, setVerificationRefs] = useState<Record<string,string>>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState('')

  async function refresh() {
    try {
      const [p, b, d, c] = await Promise.all([
        loadWhiteLabelPermissions(), loadWhiteLabelSettings(), loadWhiteLabelDomains(), loadWhiteLabelCatalog(),
      ])
      setPermissions(p); setBrand(b); setDomains(d); setCatalog(c)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar o White Label.')
    }
  }

  useEffect(() => { void refresh() }, [])

  const selectedIds = useMemo(() => catalog.filter((item) => item.selected).map((item) => item.id), [catalog])
  const featuredIds = useMemo(() => catalog.filter((item) => item.selected && item.featured).map((item) => item.id), [catalog])

  async function saveBrand(event: FormEvent) {
    event.preventDefault(); setBusy('brand')
    try {
      const saved = await saveWhiteLabelSettings(brand)
      setBrand(saved); setMessage('Identidade visual salva. Certificados futuros usarão snapshot desta marca.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao salvar marca.') }
    finally { setBusy('') }
  }

  async function requestDomain(event: FormEvent) {
    event.preventDefault(); if (!hostname.trim()) return
    setBusy('domain')
    try {
      await requestWhiteLabelDomain(hostname)
      setHostname(''); setDomains(await loadWhiteLabelDomains())
      setMessage('Domínio registrado como pendente. Nenhuma alteração de DNS foi executada pela Academy.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao registrar domínio.') }
    finally { setBusy('') }
  }

  async function domainAction(domain: WhiteLabelDomain, action: 'verify'|'set_primary'|'disable') {
    setBusy(domain.id)
    try {
      await updateWhiteLabelDomain({
        domainId: domain.id, action,
        verificationReference: action === 'verify' ? verificationRefs[domain.id]?.trim() : undefined,
        makePrimary: action === 'verify',
      })
      setDomains(await loadWhiteLabelDomains())
      setMessage(action === 'verify' ? 'Verificação registrada com evidência humana.' : action === 'set_primary' ? 'Domínio primário atualizado.' : 'Domínio desativado.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha na operação do domínio.') }
    finally { setBusy('') }
  }

  function toggleCourse(courseId: string, selected: boolean) {
    setCatalog((items) => items.map((item) => item.id === courseId ? { ...item, selected, featured: selected ? item.featured : false } : item))
  }

  function toggleFeatured(courseId: string, featured: boolean) {
    setCatalog((items) => items.map((item) => item.id === courseId ? { ...item, selected: featured ? true : item.selected, featured } : item))
  }

  async function saveCatalog() {
    setBusy('catalog')
    try {
      await saveWhiteLabelCatalog(selectedIds, featuredIds)
      setMessage('Escopo do catálogo white label atualizado.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao salvar catálogo.') }
    finally { setBusy('') }
  }

  if (!permissions.canConfigure) return <div className="panel"><h2>White Label</h2><p>Seu perfil não possui permissão administrativa para configurar este tenant.</p></div>

  return <div className="whiteLabelPage">
    <div className="pageHeader"><div><h1>White Label</h1><p>Identidade, domínio e catálogo por tenant com fallback seguro para a marca iFarm.</p>{message && <small className="whiteLabelMessage">{message}</small>}</div></div>

    <div className="whiteLabelGrid">
      <form className="panel whiteLabelForm" onSubmit={saveBrand}>
        <div className="panelTitle"><h2>Identidade visual</h2><span>Sem CSS arbitrário</span></div>
        <label>Marca<input required maxLength={80} value={brand.brandName} onChange={(e)=>setBrand({...brand,brandName:e.target.value})}/></label>
        <label>Nome da Academy<input required maxLength={120} value={brand.academyName} onChange={(e)=>setBrand({...brand,academyName:e.target.value})}/></label>
        <div className="whiteLabelColorGrid">
          <label>Primária<input type="color" value={brand.primaryColor} onChange={(e)=>setBrand({...brand,primaryColor:e.target.value.toUpperCase()})}/></label>
          <label>Secundária<input type="color" value={brand.secondaryColor} onChange={(e)=>setBrand({...brand,secondaryColor:e.target.value.toUpperCase()})}/></label>
          <label>Destaque<input type="color" value={brand.accentColor} onChange={(e)=>setBrand({...brand,accentColor:e.target.value.toUpperCase()})}/></label>
        </div>
        <label>Referência do logo<input value={brand.logoRef ?? ''} onChange={(e)=>setBrand({...brand,logoRef:e.target.value||null})} placeholder="https://... ou /assets/..."/></label>
        <label>Título do certificado<input maxLength={160} value={brand.certificateHeading ?? ''} onChange={(e)=>setBrand({...brand,certificateHeading:e.target.value||null})} placeholder="Certificado de Conclusão"/></label>
        <label>Escopo do catálogo<select value={brand.catalogMode} onChange={(e)=>setBrand({...brand,catalogMode:e.target.value as WhiteLabelBrand['catalogMode']})}><option value="all_tenant_courses">Todos os cursos publicados do tenant</option><option value="selected_courses">Somente cursos selecionados</option></select></label>
        <button className="primary" disabled={busy==='brand'}>{busy==='brand'?'Salvando...':'Salvar identidade'}</button>
      </form>

      <section className="panel whiteLabelPreview">
        <div className="panelTitle"><h2>Prévia</h2><span>Marca do tenant</span></div>
        <article style={{borderTopColor:brand.primaryColor}}>
          <div className="whiteLabelPreviewBrand">{brand.logoRef?<img src={brand.logoRef} alt="Prévia do logo"/>:<strong style={{color:brand.primaryColor}}>{brand.brandName}</strong>}</div>
          <small style={{color:brand.secondaryColor}}>{brand.academyName}</small>
          <h3 style={{color:brand.primaryColor}}>{brand.certificateHeading||'Certificado de Conclusão'}</h3>
          <p>Cores são aplicadas por propriedades controladas. Nenhum CSS personalizado é executado.</p>
          <span className="whiteLabelSwatch" style={{background:brand.accentColor}}>Destaque</span>
        </article>
      </section>
    </div>

    <section className="panel whiteLabelDomains">
      <div className="panelTitle"><h2>Domínios</h2><span>DNS não é alterado automaticamente</span></div>
      <form className="whiteLabelDomainForm" onSubmit={requestDomain}><input value={hostname} onChange={(e)=>setHostname(e.target.value)} placeholder="academy.parceiro.com.br"/><button className="primary" disabled={busy==='domain'||!hostname.trim()}>Solicitar domínio</button></form>
      <div className="whiteLabelDomainList">{domains.map((domain)=><article key={domain.id}>
        <div><strong>{domain.hostname}</strong><span className={`whiteLabelDomainStatus ${domain.status}`}>{domainLabel[domain.status]}{domain.isPrimary?' · Primário':''}</span></div>
        {domain.verificationReference&&<small>Referência: {domain.verificationReference}</small>}
        {permissions.canVerifyDomains&&domain.status==='pending'&&<div className="whiteLabelVerify"><input value={verificationRefs[domain.id]??''} onChange={(e)=>setVerificationRefs({...verificationRefs,[domain.id]:e.target.value})} placeholder="Referência/evidência de verificação"/><button disabled={busy===domain.id||!(verificationRefs[domain.id]?.trim())} onClick={()=>void domainAction(domain,'verify')}>Registrar verificação</button></div>}
        {permissions.canVerifyDomains&&domain.status==='verified'&&!domain.isPrimary&&<button disabled={busy===domain.id} onClick={()=>void domainAction(domain,'set_primary')}>Definir como primário</button>}
        {permissions.canVerifyDomains&&domain.status!=='disabled'&&<button disabled={busy===domain.id} onClick={()=>void domainAction(domain,'disable')}>Desativar</button>}
      </article>)}{!domains.length&&<div className="enterpriseEmpty">Nenhum domínio solicitado.</div>}</div>
      {!permissions.canVerifyDomains&&<small>A confirmação de domínio é uma ação reservada à administração iFarm e exige evidência externa registrada.</small>}
    </section>

    <section className="panel whiteLabelCatalog">
      <div className="panelTitle"><h2>Catálogo do tenant</h2><span>{brand.catalogMode==='selected_courses'?'Seleção explícita':'Todos os publicados'}</span></div>
      {brand.catalogMode==='selected_courses'?<>
        <div className="whiteLabelCourseList">{catalog.map((course)=><article key={course.id}><div><strong>{course.title}</strong><small>{course.status}</small></div><label><input type="checkbox" checked={course.selected} onChange={(e)=>toggleCourse(course.id,e.target.checked)}/> Visível</label><label><input type="checkbox" checked={course.featured} onChange={(e)=>toggleFeatured(course.id,e.target.checked)}/> Destaque</label></article>)}</div>
        <button className="primary" disabled={busy==='catalog'} onClick={()=>void saveCatalog()}>{busy==='catalog'?'Salvando...':'Salvar seleção do catálogo'}</button>
      </>:<p>O catálogo utiliza todos os cursos publicados do tenant. A seleção abaixo fica preservada, mas só será aplicada ao mudar para “Somente cursos selecionados”.</p>}
    </section>
  </div>
}
