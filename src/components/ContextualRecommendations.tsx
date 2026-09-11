import { useEffect, useState } from 'react'
import { loadPublicRecommendations, type PublicRecommendationSet, type RecommendationSurface } from '../services/editorialRecommendationsApi'
import { EditorialRecommendationRail } from './EditorialRecommendationRail'

export function ContextualRecommendations({surface,contextRef}:{surface:Exclude<RecommendationSurface,'home'>;contextRef:string}){
  const [sets,setSets]=useState<PublicRecommendationSet[]>([])
  useEffect(()=>{let cancelled=false;setSets([]);void loadPublicRecommendations({surface,contextRef}).then((result)=>{if(!cancelled)setSets(result.data)}).catch(()=>{if(!cancelled)setSets([])});return()=>{cancelled=true}},[surface,contextRef])
  return <EditorialRecommendationRail sets={sets}/>
}
