import { describe, expect, it } from 'vitest'
import { robotsTxt, sitemapXml } from './_publicSeo'

describe('public SEO helpers',()=>{
  it('escapes XML, removes duplicates and rejects private routes',()=>{
    const xml=sitemapXml('https://academy.example.com/',[
      {path:'/',priority:1},
      {path:'/courses/a&b',lastModified:'2026-09-14'},
      {path:'/courses/a&b'},
      {path:'/app'},
      {path:'/api/internal'},
    ])
    expect(xml).toContain('https://academy.example.com/courses/a&amp;b')
    expect(xml.match(/courses\/a&amp;b/g)?.length).toBe(1)
    expect(xml).not.toContain('/app')
    expect(xml).not.toContain('/api/internal')
  })

  it('blocks all indexing outside production',()=>{
    expect(robotsTxt({origin:'https://stage.example.com',production:false,publicHostConfigured:true}))
      .toBe('User-agent: *\nDisallow: /\n')
  })

  it('publishes sitemap and blocks private/public-utility routes in production',()=>{
    const robots=robotsTxt({origin:'https://academy.example.com',production:true,publicHostConfigured:true})
    expect(robots).toContain('Allow: /')
    expect(robots).toContain('Disallow: /app')
    expect(robots).toContain('Disallow: /search')
    expect(robots).toContain('Sitemap: https://academy.example.com/sitemap.xml')
  })
})
