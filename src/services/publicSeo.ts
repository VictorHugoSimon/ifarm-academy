export interface PublicSeoInput {
  title: string
  description: string
  canonicalPath?: string
  imageRef?: string | null
  type?: 'website'|'article'
  index?: boolean
}

function meta(selector:string,attributes:Record<string,string>,content:string){
  let element=document.head.querySelector<HTMLMetaElement>(selector)
  if(!element){element=document.createElement('meta');for(const[key,value]of Object.entries(attributes))element.setAttribute(key,value);document.head.appendChild(element)}
  element.setAttribute('content',content)
}

function canonical(path:string){
  let link=document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if(!link){link=document.createElement('link');link.rel='canonical';document.head.appendChild(link)}
  const url=new URL(path,window.location.origin)
  if(url.origin!==window.location.origin)url.href=window.location.origin+'/'
  link.href=url.toString()
  return url.toString()
}

export function applyPublicSeo(input:PublicSeoInput){
  const title=input.title.trim()||'iFarm Academy'
  const description=input.description.trim().slice(0,320)||'Educação conectada ao ecossistema iFarm.'
  const canonicalUrl=canonical(input.canonicalPath??window.location.pathname)
  document.title=title
  meta('meta[name="description"]',{name:'description'},description)
  meta('meta[name="robots"]',{name:'robots'},input.index===false?'noindex,nofollow':'index,follow,max-image-preview:large')
  meta('meta[property="og:title"]',{property:'og:title'},title)
  meta('meta[property="og:description"]',{property:'og:description'},description)
  meta('meta[property="og:url"]',{property:'og:url'},canonicalUrl)
  meta('meta[property="og:type"]',{property:'og:type'},input.type??'website')
  meta('meta[property="og:site_name"]',{property:'og:site_name'},'iFarm Academy')
  meta('meta[name="twitter:card"]',{name:'twitter:card'},input.imageRef?'summary_large_image':'summary')
  meta('meta[name="twitter:title"]',{name:'twitter:title'},title)
  meta('meta[name="twitter:description"]',{name:'twitter:description'},description)
  if(input.imageRef){
    const image=new URL(input.imageRef,window.location.origin)
    if(image.protocol==='https:'||image.origin===window.location.origin){
      meta('meta[property="og:image"]',{property:'og:image'},image.toString())
      meta('meta[name="twitter:image"]',{name:'twitter:image'},image.toString())
    }
  }
}
