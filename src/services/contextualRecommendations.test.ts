import { describe, expect, it } from 'vitest'
import { filterContextualRecommendations } from './contextualRecommendations'
import type { PublicSearchItem } from './publicPortalApi'

const items: PublicSearchItem[] = [
  {type:'course',id:'C1',slug:'atual',title:'Atual',description:'',featured:true,href:'/courses/atual'},
  {type:'course',id:'C2',slug:'relacionado',title:'Relacionado',description:'',featured:false,href:'/courses/relacionado'},
  {type:'course',id:'C2',slug:'relacionado',title:'Duplicado',description:'',featured:false,href:'/courses/relacionado-2'},
  {type:'bundle',id:'B1',slug:'bundle',title:'Bundle',description:'',featured:false,href:'/bundles/bundle'},
]

describe('Contextual recommendations v0.64',()=>{
  it('remove o recurso atual e deduplica por tipo/id',()=>{
    expect(filterContextualRecommendations(items,'/courses/atual',4).map(item=>item.id)).toEqual(['C2','B1'])
  })
  it('limita a saída sem alterar ranking recebido da busca pública',()=>{
    expect(filterContextualRecommendations(items,'/none',2).map(item=>item.id)).toEqual(['C1','C2'])
  })
})
