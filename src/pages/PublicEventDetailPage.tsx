import { useEffect, useState, type CSSProperties } from 'react'
import { EditorialDetailRecommendations } from '../components/EditorialDetailRecommendations'
import { loadPublicContext, loadPublicEvents, type PublicBrand, type PublicEvent } from '../services/publicPortalApi'
import '../styles/public-portal.css'

const defaultBrand:PublicBrand={brandName:'iFarm',academyName:'iFarm Academy',primaryColor:'#004E3B',secondaryColor:'#087A51',accentColor:'#00825B',whiteLabelConfigured:false}
const go=(path:string)=>window.location.assign(path)
const brandStyle=(brand:PublicBrand)=>({'--portal-primary':brand.primaryColor,'--portal-secondary':brand.secondaryColor,'--portal-accent':brand.accentColor} as CSSProperties)
function dateTime(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?value:date.toLocaleString('pt-BR',{dateStyle:'medium',timeStyle:'short'})}
function price(event:PublicEvent){if(event.accessModel==='sponsored')return'Patrocinado';if(event.accessModel==='free')return'Gratuito';if(event.priceCents==null)return'Condição em definição';return new Intl.NumberFormat('pt-BR',{style:'currency',currency:event.currency||'BRL'}).format(event.priceCents/100)}

export function PublicEventDetailPage(){
  const id=decodeURIComponent(window.location.pathname.replace(/^\/events\//,''))
  const[brand,setBrand]=useState<PublicBrand>(defaultBrand)
  const[event,setEvent]=useState<PublicEvent|null>(null)
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')

  useEffect(()=>{let cancelled=false;const run=async()=>{const context=await loadPublicContext();if(cancelled)return;setBrand(context.brand);const result=await loadPublicEvents();if(cancelled)return;setBrand(result.brand);const found=result.data.find(item=>item.id===id);if(!found)throw new Error('Evento público não encontrado ou indisponível.');setEvent(found);document.title=`${found.title} · ${result.brand.academyName}`};void run().catch(reason=>{if(!cancelled)setError(reason instanceof Error?reason.message:'Evento indisponível')}).finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true}},[id])

  return <div className="publicPortal" style={brandStyle(brand)}><header className="publicPortalHeader"><button className="publicBrandButton" onClick={()=>go('/')}><span className="publicBrandMark">iF</span><span><strong>{brand.brandName}</strong><small>{brand.academyName}</small></span></button><nav><button onClick={()=>go('/events')}>Eventos</button><button onClick={()=>go('/courses')}>Cursos</button><button onClick={()=>go('/paths')}>Trilhas</button><button className="publicLogin" onClick={()=>go('/app')}>Entrar</button></nav></header>
    {loading&&<main className="publicState"><strong>Carregando evento...</strong></main>}
    {!loading&&error&&<main className="publicState error"><h1>Evento indisponível</h1><p>{error}</p><button onClick={()=>go('/events')}>Voltar à agenda</button></main>}
    {!loading&&!error&&event&&<main className="publicCourseDetail"><section className="publicCourseHero"><div><div className="publicCourseMeta"><span>{event.smartFarmExperience?'Smart Farm Experience':event.eventType.replaceAll('_',' ')}</span><span>{event.modality==='in_person'?'Presencial':event.modality==='online'?'Online':'Híbrido'}</span></div><h1>{event.title}</h1><p>{event.description}</p><div className="publicCourseDetailFacts"><span>{dateTime(event.startsAt)}</span><span>até {dateTime(event.endsAt)}</span>{event.venueName&&<span>{event.venueName}</span>}{event.capacity!=null&&<span>{Math.max(0,event.capacity-event.occupied)>0?`${Math.max(0,event.capacity-event.occupied)} vagas disponíveis`:'Lista de espera'}</span>}</div></div><aside><small>Acesso</small><strong>{price(event)}</strong><button className="primary" onClick={()=>go('/app')}>{event.accessModel==='paid'&&!event.checkoutReady?'Entrar para acompanhar':'Entrar para se inscrever'}</button>{event.accessModel==='paid'&&!event.checkoutReady&&<p>Checkout permanece desabilitado até homologação da camada de pagamento.</p>}</aside></section>{event.addressText&&<section className="publicCourseAudience"><h2>Local</h2><p>{event.addressText}</p></section>}<EditorialDetailRecommendations surface="event" contextRef={event.id}/><section className="publicCourseNotice"><strong>Inscrição protegida</strong><p>A inscrição exige autenticação. Links privados de reunião, evidências e dados dos participantes não são expostos no portal público.</p></section></main>}
    <footer className="publicPortalFooter"><div><strong>{brand.academyName}</strong><span>Educação conectada ao ecossistema iFarm.</span></div><div><button onClick={()=>go('/events')}>Agenda</button><button onClick={()=>go('/courses')}>Cursos</button><button onClick={()=>go('/paths')}>Trilhas</button></div></footer>
  </div>
}
