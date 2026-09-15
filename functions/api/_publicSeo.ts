export interface SitemapEntry {
  path: string
  lastModified?: string | null
  changeFrequency?: 'daily'|'weekly'|'monthly'|'yearly'
  priority?: number
}

function xmlEscape(value:string){return value.replace(/[&<>"']/g,(char)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;' }[char]!))}

export function publicOrigin(request:Request):string{
  const url=new URL(request.url)
  return `${url.protocol}//${url.host}`
}

export function sitemapXml(origin:string,entries:SitemapEntry[]):string{
  const normalizedOrigin=origin.replace(/\/$/,'')
  const seen=new Set<string>()
  const urls=entries.filter(entry=>{
    if(!entry.path.startsWith('/')||entry.path.startsWith('/app')||entry.path.startsWith('/api')||seen.has(entry.path))return false
    seen.add(entry.path);return true
  }).map(entry=>{
    const loc=xmlEscape(`${normalizedOrigin}${entry.path}`)
    const lastmod=entry.lastModified?`<lastmod>${xmlEscape(entry.lastModified)}</lastmod>`:''
    const freq=entry.changeFrequency?`<changefreq>${entry.changeFrequency}</changefreq>`:''
    const priority=entry.priority!=null?`<priority>${Math.max(0,Math.min(1,entry.priority)).toFixed(1)}</priority>`:''
    return `<url><loc>${loc}</loc>${lastmod}${freq}${priority}</url>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`
}

export function robotsTxt(input:{origin:string;production:boolean;publicHostConfigured:boolean}):string{
  const origin=input.origin.replace(/\/$/,'')
  if(!input.production||!input.publicHostConfigured)return 'User-agent: *\nDisallow: /\n'
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /app',
    'Disallow: /api',
    'Disallow: /search',
    'Disallow: /certificates/validate',
    'Disallow: /smart-farm/checkin',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n')
}
