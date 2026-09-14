import { useEffect, useState } from 'react'
import { EditorialRecommendationRail } from './EditorialRecommendationRail'
import { loadPublicRecommendations, type PublicRecommendationSet, type RecommendationSurface } from '../services/editorialRecommendationsApi'

export function EditorialDetailRecommendations({ surface, contextRef }: { surface: Exclude<RecommendationSurface,'home'>; contextRef: string }) {
  const [sets,setSets]=useState<PublicRecommendationSet[]>([])

  useEffect(()=>{
    let cancelled=false
    setSets([])
    if(!contextRef)return()=>{cancelled=true}
    void loadPublicRecommendations({surface,contextRef})
      .then(result=>{if(!cancelled)setSets(result.data)})
      .catch(()=>{if(!cancelled)setSets([])})
    return()=>{cancelled=true}
  },[surface,contextRef])

  return <EditorialRecommendationRail sets={sets}/>
}
