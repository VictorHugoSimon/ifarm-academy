import { useEffect, useState, type CSSProperties } from 'react'
import { ContextualRecommendations } from '../components/ContextualRecommendations'
import {
  formatAccessPrice,
  loadPublicContext,
  loadPublicInstructor,
  loadPublicInstructors,
  loadPublicPath,
  loadPublicPaths,
  type PublicBrand,
  type PublicCourse,
  type PublicInstructor,
  type PublicInstructorDetail,
  type PublicLearningPath,
  type PublicLearningPathDetail,
} from '../services/publicPortalApi'
import '../styles/public-portal.css'
import '../styles/public-discovery.css'

const defaultBrand: PublicBrand = {
  brandName: 'iFarm', academyName: 'iFarm Academy', primaryColor: '#004E3B', secondaryColor: '#087A51', accentColor: '#00825B', whiteLabelConfigured: false,
}

const go = (path: string) => window.location.assign(path)

function brandStyle(brand: PublicBrand): CSSProperties {
  return { '--portal-primary': brand.primaryColor, '--portal-secondary': brand.secondaryColor, '--portal-accent': brand.accentColor } as CSSProperties
}

function workload(minutes: number) {
  const hours = Math.floor(Math.max(0, minutes) / 60)
  const rest = Math.max(0, minutes) % 60
  return hours ? `${hours}h${rest ? ` ${rest}min` : ''}` : `${rest}min`
}

function Header({ brand }: { brand: PublicBrand }) {
  return <header className="publicPortalHeader">
    <button className="publicBrandButton" onClick={() => go('/')}><span className="publicBrandMark">iF</span><span><strong>{brand.brandName}</strong><small>{brand.academyName}</small></span></button>
    <nav aria-label="Portal público"><button onClick={() => go('/courses')}>Cursos</button><button onClick={() => go('/paths')}>Trilhas</button><button onClick={() => go('/instructors')}>Instrutores</button><button onClick={() => go('/events')}>Eventos</button><button className="publicLogin" onClick={() => go('/app')}>Entrar</button></nav>
  </header>
}

function CourseCard({ course }: { course: PublicCourse }) {
  return <article className="publicCourseCard"><button className="publicCourseCover" onClick={() => go(`/courses/${course.slug}`)}>{course.coverRef ? <img src={course.coverRef} alt="" /> : <span>{course.category || 'iFarm Academy'}</span>}</button><div className="publicCourseBody"><div className="publicCourseMeta"><span>{course.category || 'Curso'}</span>{course.levelLabel && <span>{course.levelLabel}</span>}</div><h3>{course.title}</h3><p>{course.description}</p><div className="publicCourseFacts"><span>{workload(course.workloadMinutes)}</span><span>{course.lessonCount} aulas</span></div><div className="publicCourseFooter"><strong>{formatAccessPrice(course)}</strong><button onClick={() => go(`/courses/${course.slug}`)}>Ver curso</button></div></div></article>
}

function PathCard({ path }: { path: PublicLearningPath }) {
  return <article className="publicDiscoveryCard"><button className="publicDiscoveryCover" onClick={() => go(`/paths/${path.slug}`)}>{path.coverRef ? <img src={path.coverRef} alt="" /> : <span>{path.category || 'Trilha iFarm'}</span>}</button><div><small>{path.category || 'Trilha de aprendizagem'}</small><h3>{path.title}</h3><p>{path.shortDescription || path.description}</p><div className="publicDiscoveryFacts"><span>{path.courseCount} cursos</span><span>{workload(path.workloadMinutes)}</span></div><footer><strong>{formatAccessPrice(path)}</strong><button onClick={() => go(`/paths/${path.slug}`)}>Ver trilha</button></footer></div></article>
}

function InstructorCard({ instructor }: { instructor: PublicInstructor }) {
  return <article className="publicInstructorCard"><button className="publicInstructorPhoto" onClick={() => go(`/instructors/${instructor.slug}`)}>{instructor.photoRef ? <img src={instructor.photoRef} alt="" /> : <span>{instructor.displayName.slice(0,2).toUpperCase()}</span>}</button><div><h3>{instructor.displayName}</h3>{instructor.headline && <strong>{instructor.headline}</strong>}<p>{instructor.shortBio || 'Instrutor da iFarm Academy.'}</p><div className="publicTagRow">{instructor.specialties.slice(0,4).map((item) => <span key={item}>{item}</span>)}</div><footer><small>{instructor.publicCourseCount} cursos públicos</small><button onClick={() => go(`/instructors/${instructor.slug}`)}>Ver perfil</button></footer></div></article>
}

export function PublicDiscoveryPage() {
  const pathname = window.location.pathname
  const instructorMatch = pathname.match(/^\/instructors\/([a-z0-9-]+)$/)
  const pathMatch = pathname.match(/^\/paths\/([a-z0-9-]+)$/)
  const view = instructorMatch ? 'instructor' : pathMatch ? 'path' : pathname === '/instructors' ? 'instructors' : pathname === '/paths' ? 'paths' : 'not-found'
  const [brand, setBrand] = useState<PublicBrand>(defaultBrand)
  const [instructors, setInstructors] = useState<PublicInstructor[]>([])
  const [paths, setPaths] = useState<PublicLearningPath[]>([])
  const [instructor, setInstructor] = useState<PublicInstructorDetail | null>(null)
  const [path, setPath] = useState<PublicLearningPathDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    const run = async () => {
      const context = await loadPublicContext(); if (cancelled) return
      setBrand(context.brand); document.title = context.brand.academyName
      if (view === 'instructors') {
        const result = await loadPublicInstructors(); if (!cancelled) { setBrand(result.brand); setInstructors(result.data) }
      } else if (view === 'paths') {
        const result = await loadPublicPaths(); if (!cancelled) { setBrand(result.brand); setPaths(result.data) }
      } else if (view === 'instructor' && instructorMatch) {
        const result = await loadPublicInstructor(instructorMatch[1]); if (!cancelled) { setBrand(result.brand); setInstructor(result.data); document.title = result.data.seoTitle || `${result.data.displayName} · ${result.brand.academyName}` }
      } else if (view === 'path' && pathMatch) {
        const result = await loadPublicPath(pathMatch[1]); if (!cancelled) { setBrand(result.brand); setPath(result.data); document.title = result.data.seoTitle || `${result.data.title} · ${result.brand.academyName}` }
      }
    }
    void run().catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Conteúdo indisponível') }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [pathname])

  return <div className="publicPortal" style={brandStyle(brand)}><Header brand={brand} />
    {loading && <main className="publicState"><strong>Carregando...</strong></main>}
    {!loading && error && <main className="publicState error"><h1>Conteúdo indisponível</h1><p>{error}</p><button onClick={() => go('/')}>Voltar ao início</button></main>}
    {!loading && !error && view === 'paths' && <main className="publicPage"><div className="publicPageHeading"><small>Jornadas de aprendizagem</small><h1>Trilhas</h1><p>Sequências de cursos organizadas para desenvolver competências de forma progressiva.</p></div><div className="publicDiscoveryGrid">{paths.map((item) => <PathCard key={item.id} path={item} />)}</div>{!paths.length && <p className="publicEmpty">Nenhuma trilha pública configurada.</p>}</main>}
    {!loading && !error && view === 'instructors' && <main className="publicPage"><div className="publicPageHeading"><small>Especialistas</small><h1>Instrutores</h1><p>Conheça os profissionais com perfil explicitamente publicado neste portal.</p></div><div className="publicInstructorGrid">{instructors.map((item) => <InstructorCard key={item.instructorId} instructor={item} />)}</div>{!instructors.length && <p className="publicEmpty">Nenhum perfil público de instrutor configurado.</p>}</main>}
    {!loading && !error && view === 'instructor' && instructor && <main className="publicPage"><section className="publicProfileHero"><div className="publicProfileAvatar">{instructor.photoRef ? <img src={instructor.photoRef} alt="" /> : <span>{instructor.displayName.slice(0,2).toUpperCase()}</span>}</div><div><small>Instrutor</small><h1>{instructor.displayName}</h1>{instructor.headline && <h2>{instructor.headline}</h2>}<p>{instructor.shortBio}</p><div className="publicTagRow">{instructor.specialties.map((item) => <span key={item}>{item}</span>)}</div>{instructor.credentialSummary && <div className="publicCredential"><strong>Resumo profissional publicado</strong><p>{instructor.credentialSummary}</p></div>}</div></section><ContextualRecommendations surface="instructor" contextRef={instructor.instructorId}/><section className="publicSection"><div className="publicSectionTitle"><div><small>Formação</small><h2>Cursos públicos</h2></div></div><div className="publicCourseGrid">{instructor.courses.map((course) => <CourseCard key={course.id} course={course} />)}</div>{!instructor.courses.length && <p>Este instrutor ainda não possui cursos públicos neste catálogo.</p>}</section><section className="publicCourseNotice"><strong>Governança profissional</strong><p>Este perfil publica apenas informações selecionadas para apresentação. Evidências privadas, registros profissionais e decisões de responsabilidade técnica não são expostos automaticamente.</p></section></main>}
    {!loading && !error && view === 'path' && path && <main className="publicPage"><section className="publicPathHero"><div><small>{path.category || 'Trilha de aprendizagem'}</small><h1>{path.title}</h1><p>{path.shortDescription || path.description}</p><div className="publicDiscoveryFacts"><span>{path.courseCount} cursos</span><span>{workload(path.workloadMinutes)}</span></div></div><aside><small>Acesso</small><strong>{formatAccessPrice(path)}</strong><button className="primary" onClick={() => go('/app')}>{path.accessModel === 'paid' ? 'Entrar para comprar' : 'Entrar para aprender'}</button>{path.accessModel === 'paid' && <p>Checkout permanece desabilitado até homologação da camada de pagamento.</p>}</aside></section><ContextualRecommendations surface="path" contextRef={path.id}/><section className="publicSection"><div className="publicSectionTitle"><div><small>Sequência</small><h2>Cursos da trilha</h2></div></div><div className="publicCourseGrid">{path.courses.sort((a,b) => a.position-b.position).map((course) => <CourseCard key={course.id} course={course} />)}</div></section></main>}
    {!loading && !error && view === 'not-found' && <main className="publicState"><h1>Página não encontrada</h1><button onClick={() => go('/')}>Voltar</button></main>}
    <footer className="publicPortalFooter"><div><strong>{brand.academyName}</strong><span>Educação conectada ao ecossistema iFarm.</span></div><div><button onClick={() => go('/courses')}>Cursos</button><button onClick={() => go('/paths')}>Trilhas</button><button onClick={() => go('/instructors')}>Instrutores</button><button onClick={() => go('/events')}>Eventos</button></div></footer>
  </div>
}
