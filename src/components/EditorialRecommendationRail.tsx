import type { PublicRecommendationSet } from '../services/editorialRecommendationsApi'

function go(path:string){window.location.assign(path)}

export function EditorialRecommendationRail({sets}:{sets:PublicRecommendationSet[]}){
  if(!sets.length)return null
  return <>{sets.map(set=><section className="publicSection editorialRail" key={set.id}><div className="publicSectionTitle"><div><small>Curadoria</small><h2>{set.title}</h2>{set.subtitle&&<p className="editorialRailSubtitle">{set.subtitle}</p>}</div></div><div className="editorialRailGrid">{set.items.map(item=><article className="editorialRailCard" key={`${set.id}-${item.type}-${item.id}`}><button className="editorialRailImage" onClick={()=>go(item.href)} aria-label={`Abrir ${item.title}`}>{item.imageRef?<img src={item.imageRef} alt=""/>:<span>{item.category||item.type}</span>}</button><div className="editorialRailBody">{item.editorialLabel&&<small>{item.editorialLabel}</small>}<h3>{item.title}</h3><p>{item.editorialReason||item.description}</p><div><span>{item.category||item.type}</span><button onClick={()=>go(item.href)}>Explorar</button></div></div></article>)}</div></section>)}</>
}
