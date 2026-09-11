import { useEffect, useState } from 'react'
import { loadContextualRecommendations } from '../services/contextualRecommendations'
import type { PublicSearchItem, PublicSearchType } from '../services/publicPortalApi'
import '../styles/contextual-recommendations.css'

const labels: Record<PublicSearchType,string> = {course:'Curso',path:'Trilha',instructor:'Instrutor',event:'Evento',plan:'Plano',partner:'Parceiro',bundle:'Bundle'}

export function ContextualRecommendationsSection(props:{currentHref:string;query?:string|null;category?:string|null;types?:PublicSearchType[];title?:string;limit?:number}){
  const [items,setItems]=useState<PublicSearchItem[]>([])
  useEffect(()=>{let cancelled=false;void loadContextualRecommendations(props).then(result=>{if(!cancelled)setItems(result.items)}).catch(()=>{if(!cancelled)setItems([])});return()=>{cancelled=true}},[props.currentHref,props.query,props.category,props.types?.join(','),props.limit])
  if(!items.length)return null
  return <section className="contextualRecommendations"><div className="contextualHead"><div><small>Descoberta contextual</small><h2>{props.title||'Explore também'}</h2></div><p>Selecionado pelo contexto desta página. Sem histórico do visitante, perfilamento ou geração automática de lead.</p></div><div className="contextualGrid">{items.map(item=><article key={`${item.type}-${item.id}`}><button className="contextualImage" onClick={()=>window.location.assign(item.href)}>{item.imageRef?<img src={item.imageRef} alt=""/>:<span>{labels[item.type].slice(0,2)}</span>}</button><div><small>{labels[item.type]}{item.category?` · ${item.category}`:''}</small><h3>{item.title}</h3><p>{item.description}</p><button onClick={()=>window.location.assign(item.href)}>Explorar</button></div></article>)}</div></section>
}
