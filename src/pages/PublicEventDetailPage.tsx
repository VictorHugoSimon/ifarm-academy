import { useEffect, useState, type CSSProperties } from 'react'
import { ContextualRecommendations } from '../components/ContextualRecommendations'
import { loadPublicEventDetail } from '../services/publicEventDetailApi'
import type { PublicBrand, PublicEvent } from '../services/publicPortalApi'
import '../styles/public-portal.css'

const defaultBrand:PublicBrand={brandName:'iFarm',academyName:'iFarm Academy',primaryColor:'#004E3B',secondaryColor:'#087A51',accentColor:'#00825B',whiteLabelConfigured:false}
const go=(path:string)=>window.location.assign(path)
const style=(brand:PublicBrand)=>({'--portal-primary':brand.primaryColor,'--portal-secondary':brand.secondaryColor,'--portal-accent':brand.accentColor} as CSSProperties)
function dateTime(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?value:date.toLocaleString('pt-BR',{dateStyle:'full',timeStyle:'short'})}

export function PublicEventDetailPage(){
  const match=window.location.pathname.match(/^\/events\/([^/]+)$/);const id=match?.[1]??''
  const[brand,setBrand]=useState<PublicBrand>(defaultBrand);const[event,setEvent]=useState<PublicEvent|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState('')
  useEffect(()=>{let cancelled=false;setLoading(true);setError('');void loadPublicEventDetail(id).then((result)=>{if(cancelled)return;setBrand(result.brand);setEvent(result.data);document.title=`${result.data.title} · ${result.brand.academyName}`}).catch((reason)=>{if(!cancelled)setError(reason instanceof Error?reason.message:'Evento indisponível')}).finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true}},[id])
  const available=event?.capacity==null?null:Math.max(0,event.capacity-event.occupied)
  return <div className="publicPortal" style={style(brand)}><header className="publicPortalHeader"><button className="publicBrandButton" onClick={()=>go('/')}><span className="publicBrandMark">iF</span><span><strong>{brand.brandName}</strong><small>{brand.academyName}</small></span></button><nav><button onClick={()=>go('/events')}>Eventos</button><button onClick={()=>go('/courses')}>Cursos</button><button onClick={()=>go('/paths')}>Trilhas</button><button className="publicLogin" onClick={()=>go('/app')}>Entrar</button></nav></header>
    {loading&&<main className="publicState"><strong>Carregando evento...</strong></main>}
    {!loading&&error&&<main className="publicState error"><h1>Evento indisponível</h1><p>{error}</p><button onClick={()=>go('/events')}>Voltar à agenda</button></main>}
    {!loading&&event&&<main className="publicPage"><section className="publicCourseHero"><div><div className="publicCourseMeta"><span>{event.smartFarmExperience?'Smart Farm Experience':event.eventType.replaceAll('_',' ')}</span><span>{event.modality==='in_person'?'Presencial':event.modality==='online'?'Online':'Híbrido'}</span></div><h1>{event.title}</h1><p>{event.description}</p><div className="publicCourseDetailFacts"><span>{dateTime(event.startsAt)}</span>{event.venueName&&<span>{event.venueName}</span>}{available!=null&&<span>{available>0?`${available} vagas disponíveis`:'Lista de espera'}</span>}</div></div><aside><small>Acesso</small><strong>{event.accessModel==='paid'&&event.priceCents!=null?new Intl.NumberFormat('pt-BR',{style:'currency',currency:event.currency}).format(event.priceCents/100):event.accessModel==='sponsored'?'Patrocinado':'Gratuito'}</strong><button className="primary" onClick={()=>go('/app')}>{event.accessModel==='paid'&&!event.checkoutReady?'Entrar para acompanhar':'Entrar para se inscrever'}</button>{event.accessModel==='paid'&&!event.checkoutReady&&<p>Checkout será habilitado apenas após homologação da camada de pagamento.</p>}</aside></section><section className="publicCourseAudience"><h2>Detalhes do evento</h2><p><strong>Início:</strong> {dateTime(event.startsAt)}<br/><strong>Término:</strong> {dateTime(event.endsAt)}{event.addressText&&<><br/><strong>Endereço:</strong> {event.addressText}</>}</p></section><ContextualRecommendations surface="event" contextRef={event.id}/><section className="publicCourseNotice"><strong>Privacidade operacional</strong><p>Links de reunião e dados privados de participantes não são expostos no portal público. Inscrição e acesso operacional exigem autenticação.</p></section></main>}
  </div>
}
