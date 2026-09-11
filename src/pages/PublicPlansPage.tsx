import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ContextualRecommendations } from '../components/ContextualRecommendations'
import { formatPlanPrice, loadPublicContext, loadPublicPlan, loadPublicPlans, type PublicBrand, type PublicPlan } from '../services/publicPortalApi'
import '../styles/public-portal.css'
import '../styles/public-plans.css'

const defaultBrand: PublicBrand = { brandName:'iFarm', academyName:'iFarm Academy', primaryColor:'#004E3B', secondaryColor:'#087A51', accentColor:'#00825B', whiteLabelConfigured:false }
const go = (path: string) => window.location.assign(path)
const brandStyle = (brand: PublicBrand) => ({ '--portal-primary':brand.primaryColor,'--portal-secondary':brand.secondaryColor,'--portal-accent':brand.accentColor } as CSSProperties)

function Header({ brand }: { brand: PublicBrand }) {
  return <header className="publicPortalHeader"><button className="publicBrandButton" onClick={() => go('/')}><span className="publicBrandMark">iF</span><span><strong>{brand.brandName}</strong><small>{brand.academyName}</small></span></button><nav aria-label="Portal público"><button onClick={() => go('/courses')}>Cursos</button><button onClick={() => go('/paths')}>Trilhas</button><button onClick={() => go('/plans')}>Planos</button><button onClick={() => go('/instructors')}>Instrutores</button><button onClick={() => go('/events')}>Eventos</button><button className="publicLogin" onClick={() => go('/app')}>Entrar</button></nav></header>
}

function PlanPrice({ plan }: { plan: PublicPlan }) {
  if (plan.commercialMode === 'free') return <strong className="planPriceMain">Gratuito</strong>
  if (plan.commercialMode === 'contact_sales') return <strong className="planPriceMain">Fale com a iFarm</strong>
  const preferred = plan.prices.find((price) => price.billingInterval === 'monthly') ?? plan.prices[0]
  return preferred ? <strong className="planPriceMain">{formatPlanPrice(preferred)}</strong> : <strong className="planPriceMain">Preço indisponível</strong>
}

function PlanCard({ plan }: { plan: PublicPlan }) {
  const benefitCount = plan.courses.length + plan.paths.length + plan.externalBenefits.length
  return <article className={`publicPlanCard ${plan.featured ? 'featured' : ''}`}><div className="planCardTop"><span>{plan.audienceType === 'corporate' ? 'Empresas' : plan.audienceType === 'partner' ? 'Parceiros' : 'Individual'}</span>{plan.featured && <b>Destaque</b>}</div><h2>{plan.name}</h2><p>{plan.description}</p><PlanPrice plan={plan} /><div className="planFacts"><span>{plan.courses.length} cursos</span><span>{plan.paths.length} trilhas</span><span>{benefitCount} benefícios</span>{plan.maxUsers && <span>Até {plan.maxUsers} usuários</span>}</div><button className="primary" onClick={() => go(`/plans/${plan.slug}`)}>Ver plano</button></article>
}

export function PublicPlansPage() {
  const pathname = window.location.pathname
  const detailMatch = pathname.match(/^\/plans\/([a-z0-9-]+)$/)
  const [brand,setBrand] = useState<PublicBrand>(defaultBrand)
  const [plans,setPlans] = useState<PublicPlan[]>([])
  const [detail,setDetail] = useState<PublicPlan|null>(null)
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    const run = async () => {
      const context = await loadPublicContext(); if (cancelled) return
      setBrand(context.brand); document.title = context.brand.academyName
      if (detailMatch) {
        const result = await loadPublicPlan(detailMatch[1]); if (!cancelled) { setBrand(result.brand); setDetail(result.data); document.title = result.data.seoTitle || `${result.data.name} · ${result.brand.academyName}` }
      } else {
        const result = await loadPublicPlans(); if (!cancelled) { setBrand(result.brand); setPlans(result.data) }
      }
    }
    void run().catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Planos indisponíveis') }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [pathname])

  const featured = useMemo(() => plans.filter((plan) => plan.featured), [plans])
  const ordered = featured.length ? [...featured, ...plans.filter((plan) => !plan.featured)] : plans

  return <div className="publicPortal" style={brandStyle(brand)}><Header brand={brand} />
    {loading && <main className="publicState"><strong>Carregando planos...</strong></main>}
    {!loading && error && <main className="publicState error"><h1>Planos indisponíveis</h1><p>{error}</p><button onClick={() => go('/')}>Voltar ao início</button></main>}
    {!loading && !error && !detailMatch && <main className="publicPage"><div className="publicPageHeading"><small>Planos e acesso</small><h1>Escolha como aprender com a iFarm Academy</h1><p>Planos individuais, corporativos e para parceiros. Valores só aparecem quando foram explicitamente configurados e publicados.</p></div><div className="publicPlanGrid">{ordered.map((plan) => <PlanCard key={plan.id} plan={plan} />)}</div>{!ordered.length && <p className="publicEmpty">Nenhum plano público configurado.</p>}<section className="publicCourseNotice"><strong>Cobrança protegida</strong><p>A v0.41 exibe condições comerciais, mas não cria assinatura nem confirma pagamento. Checkout será habilitado somente após homologação de identidade, Mercado Pago e regras fiscais.</p></section></main>}
    {!loading && !error && detail && <main className="publicPage"><section className="publicPlanHero"><div><small>{detail.audienceType === 'corporate' ? 'Plano corporativo' : detail.audienceType === 'partner' ? 'Plano parceiro' : 'Plano individual'}</small><h1>{detail.name}</h1><p>{detail.description}</p><div className="planFacts"><span>{detail.courses.length} cursos</span><span>{detail.paths.length} trilhas</span>{detail.maxUsers && <span>Até {detail.maxUsers} usuários</span>}</div></div><aside><small>Condição comercial</small><PlanPrice plan={detail}/>{detail.prices.length > 1 && <div className="planPriceOptions">{detail.prices.map((price) => <span key={price.id}>{formatPlanPrice(price)}</span>)}</div>}<button className="primary" onClick={() => go('/app')}>{detail.commercialMode === 'contact_sales' ? 'Entrar e falar com a iFarm' : detail.commercialMode === 'free' ? 'Entrar para começar' : 'Entrar para acompanhar'}</button>{detail.commercialMode === 'priced' && <p>Assinatura e cobrança ainda não são criadas nesta versão.</p>}</aside></section><ContextualRecommendations surface="plan" contextRef={detail.id}/>
      <section className="publicSection"><div className="publicSectionTitle"><div><small>Incluído</small><h2>Conteúdo do plano</h2></div></div><div className="planBenefitColumns"><article><h3>Cursos</h3>{detail.courses.map((course) => <button key={course.id} onClick={() => go(`/courses/${course.slug}`)}>{course.title}</button>)}{!detail.courses.length && <p>Nenhum curso público neste catálogo.</p>}</article><article><h3>Trilhas</h3>{detail.paths.map((path) => <button key={path.id} onClick={() => go(`/paths/${path.slug}`)}>{path.title}</button>)}{!detail.paths.length && <p>Nenhuma trilha pública neste catálogo.</p>}</article><article><h3>Benefícios do ecossistema</h3>{detail.externalBenefits.map((benefit,index) => <div key={`${benefit.sourceSystem}-${index}`}><strong>{benefit.label}</strong><p>{benefit.description}</p></div>)}{!detail.externalBenefits.length && <p>Nenhum benefício externo publicado.</p>}</article></div></section><section className="publicCourseNotice"><strong>Integração sem duplicação</strong><p>Benefícios de Store, Services, Finance, Insurance, Core ou parceiros são apenas referências publicadas. Produto, estoque, contrato e elegibilidade continuam pertencendo aos sistemas responsáveis.</p></section></main>}
    <footer className="publicPortalFooter"><div><strong>{brand.academyName}</strong><span>Educação conectada ao ecossistema iFarm.</span></div><div><button onClick={() => go('/courses')}>Cursos</button><button onClick={() => go('/paths')}>Trilhas</button><button onClick={() => go('/plans')}>Planos</button><button onClick={() => go('/instructors')}>Instrutores</button><button onClick={() => go('/events')}>Eventos</button></div></footer>
  </div>
}
