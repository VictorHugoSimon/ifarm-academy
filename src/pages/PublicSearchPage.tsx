import { FormEvent, useEffect, useState, type CSSProperties } from 'react'
import {
  loadPublicSearch,
  type PublicBrand,
  type PublicSearchItem,
  type PublicSearchResponse,
  type PublicSearchType,
} from '../services/publicPortalApi'
import '../styles/public-search.css'

const defaultBrand: PublicBrand = {
  brandName: 'iFarm', academyName: 'iFarm Academy', primaryColor: '#004E3B', secondaryColor: '#087A51', accentColor: '#00825B', whiteLabelConfigured: false,
}

const typeLabels: Record<PublicSearchType, string> = {
  course: 'Cursos', path: 'Trilhas', instructor: 'Instrutores', event: 'Eventos', plan: 'Planos',
}

function brandStyle(brand: PublicBrand): CSSProperties {
  return {
    '--portal-primary': brand.primaryColor,
    '--portal-secondary': brand.secondaryColor,
    '--portal-accent': brand.accentColor,
  } as CSSProperties
}

function initialTypes(params: URLSearchParams): PublicSearchType[] {
  const allowed = new Set<PublicSearchType>(['course', 'path', 'instructor', 'event', 'plan'])
  const parsed = (params.get('types') ?? '').split(',').filter((value): value is PublicSearchType => allowed.has(value as PublicSearchType))
  return parsed.length ? parsed : [...allowed]
}

function go(path: string) { window.location.assign(path) }

function accessLabel(value?: string | null) {
  if (value === 'free') return 'Gratuito'
  if (value === 'paid') return 'Pago'
  if (value === 'sponsored') return 'Patrocinado'
  if (value === 'included') return 'Incluído'
  if (value === 'contact_sales') return 'Fale com vendas'
  return value || ''
}

function modalityLabel(value?: string | null) {
  if (value === 'in_person') return 'Presencial'
  if (value === 'online') return 'Online'
  if (value === 'hybrid') return 'Híbrido'
  return value || ''
}

function SearchResultCard({ item }: { item: PublicSearchItem }) {
  const facts = [item.category, item.level, accessLabel(item.accessModel), modalityLabel(item.modality)].filter(Boolean) as string[]
  return <article className="publicSearchCard">
    <button className="publicSearchThumb" onClick={() => go(item.href)} aria-label={`Abrir ${item.title}`}>
      {item.imageRef ? <img src={item.imageRef} alt="" /> : <span>{typeLabels[item.type].slice(0, 2)}</span>}
    </button>
    <div className="publicSearchCardBody">
      <div className="publicSearchCardTop"><span className="publicSearchType">{typeLabels[item.type]}</span>{item.featured && <span className="publicSearchFeatured">Destaque</span>}</div>
      <h2>{item.title}</h2>
      <p>{item.description || 'Conteúdo publicado na iFarm Academy.'}</p>
      {facts.length > 0 && <div className="publicSearchFacts">{facts.slice(0, 4).map((fact) => <span key={fact}>{fact}</span>)}</div>}
      {item.startsAt && <small className="publicSearchDate">{new Date(item.startsAt).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })}</small>}
      <button className="publicSearchOpen" onClick={() => go(item.href)}>Ver {typeLabels[item.type].toLocaleLowerCase('pt-BR').replace(/s$/, '')}</button>
    </div>
  </article>
}

export function PublicSearchPage() {
  const params = new URLSearchParams(window.location.search)
  const [brand, setBrand] = useState<PublicBrand>(defaultBrand)
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [types, setTypes] = useState<PublicSearchType[]>(initialTypes(params))
  const [category, setCategory] = useState(params.get('category') ?? '')
  const [access, setAccess] = useState(params.get('access') ?? '')
  const [level, setLevel] = useState(params.get('level') ?? '')
  const [modality, setModality] = useState(params.get('modality') ?? '')
  const [result, setResult] = useState<PublicSearchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const offset = Math.max(0, Number(params.get('offset') ?? 0) || 0)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    void loadPublicSearch({
      q: params.get('q') ?? '', types: initialTypes(params), category: params.get('category') ?? '',
      access: params.get('access') ?? '', level: params.get('level') ?? '', modality: params.get('modality') ?? '',
      limit: 24, offset,
    }).then((payload) => {
      if (cancelled) return
      setResult(payload); setBrand(payload.brand); document.title = `Buscar · ${payload.brand.academyName}`
    }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Busca indisponível.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [window.location.search])

  function navigate(nextOffset = 0, nextTypes = types) {
    const url = new URL('/search', window.location.origin)
    if (query.trim()) url.searchParams.set('q', query.trim())
    if (nextTypes.length && nextTypes.length < 5) url.searchParams.set('types', nextTypes.join(','))
    if (category) url.searchParams.set('category', category)
    if (access) url.searchParams.set('access', access)
    if (level) url.searchParams.set('level', level)
    if (modality) url.searchParams.set('modality', modality)
    if (nextOffset > 0) url.searchParams.set('offset', String(nextOffset))
    go(url.pathname + url.search)
  }

  function submit(event: FormEvent) { event.preventDefault(); navigate(0) }

  function toggleType(type: PublicSearchType) {
    const exists = types.includes(type)
    const next = exists ? types.filter((item) => item !== type) : [...types, type]
    const safe = next.length ? next : [type]
    setTypes(safe)
    const url = new URL('/search', window.location.origin)
    if (query.trim()) url.searchParams.set('q', query.trim())
    if (safe.length < 5) url.searchParams.set('types', safe.join(','))
    if (category) url.searchParams.set('category', category)
    if (access) url.searchParams.set('access', access)
    if (level) url.searchParams.set('level', level)
    if (modality) url.searchParams.set('modality', modality)
    go(url.pathname + url.search)
  }

  return <div className="publicSearchPage" style={brandStyle(brand)}>
    <header className="publicSearchHeader">
      <button className="publicSearchBrand" onClick={() => go('/')}>
        {brand.logoRef ? <img src={brand.logoRef} alt="" /> : <span>iF</span>}
        <div><strong>{brand.brandName}</strong><small>{brand.academyName}</small></div>
      </button>
      <nav><button onClick={() => go('/courses')}>Cursos</button><button onClick={() => go('/paths')}>Trilhas</button><button onClick={() => go('/plans')}>Planos</button><button onClick={() => go('/instructors')}>Instrutores</button><button onClick={() => go('/events')}>Eventos</button><button className="publicSearchLogin" onClick={() => go('/app')}>Entrar</button></nav>
    </header>

    <main className="publicSearchMain">
      <section className="publicSearchIntro">
        <small>Descoberta iFarm Academy</small>
        <h1>Encontre conhecimento, especialistas e experiências.</h1>
        <p>Uma busca única em cursos, trilhas, instrutores, eventos e planos publicados neste portal.</p>
        <form onSubmit={submit} className="publicSearchForm">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: irrigação, IoT rural, NR-31, drones" maxLength={120} autoFocus />
          <button>Buscar</button>
        </form>
      </section>

      {!loading && !error && result && <section className="publicSearchWorkspace">
        <aside className="publicSearchFilters">
          <div><strong>Tipo</strong><div className="publicSearchTypeFilters">{(Object.keys(typeLabels) as PublicSearchType[]).map((type) => <button key={type} className={types.includes(type) ? 'active' : ''} onClick={() => toggleType(type)}><span>{typeLabels[type]}</span><small>{result.facets.types[type] ?? 0}</small></button>)}</div></div>
          <label>Categoria<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas</option>{result.facets.categories.map((item) => <option value={item.value} key={item.value}>{item.value} ({item.count})</option>)}</select></label>
          <label>Acesso<select value={access} onChange={(event) => setAccess(event.target.value)}><option value="">Todos</option>{result.facets.accessModels.map((item) => <option value={item.value} key={item.value}>{accessLabel(item.value)} ({item.count})</option>)}</select></label>
          {result.facets.levels.length > 0 && <label>Nível<select value={level} onChange={(event) => setLevel(event.target.value)}><option value="">Todos</option>{result.facets.levels.map((item) => <option value={item.value} key={item.value}>{item.value} ({item.count})</option>)}</select></label>}
          {result.facets.modalities.length > 0 && <label>Modalidade<select value={modality} onChange={(event) => setModality(event.target.value)}><option value="">Todas</option>{result.facets.modalities.map((item) => <option value={item.value} key={item.value}>{modalityLabel(item.value)} ({item.count})</option>)}</select></label>}
          <button className="publicSearchApply" onClick={() => navigate(0)}>Aplicar filtros</button>
          <button className="publicSearchClear" onClick={() => go(query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : '/search')}>Limpar filtros</button>
        </aside>

        <div className="publicSearchResults">
          <div className="publicSearchResultHeader"><div><strong>{result.pagination.total} resultados</strong>{result.query && <span> para “{result.query}”</span>}</div><small>Ranking textual + destaques editoriais. Sem personalização comportamental.</small></div>
          <div className="publicSearchGrid">{result.data.map((item) => <SearchResultCard key={`${item.type}-${item.id}`} item={item} />)}</div>
          {!result.data.length && <div className="publicSearchEmpty"><strong>Nenhum resultado encontrado.</strong><p>Tente outro termo ou remova alguns filtros.</p></div>}
          {(offset > 0 || result.pagination.hasMore) && <div className="publicSearchPagination"><button disabled={offset === 0} onClick={() => navigate(Math.max(0, offset - result.pagination.limit))}>Anterior</button><span>{offset + 1}–{Math.min(offset + result.data.length, result.pagination.total)} de {result.pagination.total}</span><button disabled={!result.pagination.hasMore} onClick={() => navigate(offset + result.pagination.limit)}>Próxima</button></div>}
        </div>
      </section>}

      {loading && <div className="publicSearchState">Buscando no portal...</div>}
      {!loading && error && <div className="publicSearchState error"><strong>Busca indisponível</strong><p>{error}</p><button onClick={() => go('/')}>Voltar ao portal</button></div>}
    </main>
    <footer className="publicSearchFooter"><strong>{brand.academyName}</strong><span>Busca pública tenant-aware, sem perfilamento do visitante.</span></footer>
  </div>
}
