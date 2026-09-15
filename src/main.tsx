import React, { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouteLoading, SkipToContent } from './components/AccessibilityTools'
import { applyPublicSeo } from './services/publicSeo'
import './styles/runtime.css'

const AcademySessionGate = lazy(() => import('./pages/AcademySessionGate').then(module => ({ default: module.AcademySessionGate })))
const AcademyWorkspacePage = lazy(() => import('./pages/AcademyWorkspacePage').then(module => ({ default: module.AcademyWorkspacePage })))
const PublicCertificateValidationPage = lazy(() => import('./pages/PublicCertificateValidationPage').then(module => ({ default: module.PublicCertificateValidationPage })))
const PublicDiscoveryPage = lazy(() => import('./pages/PublicDiscoveryPage').then(module => ({ default: module.PublicDiscoveryPage })))
const PublicEventDetailPage = lazy(() => import('./pages/PublicEventDetailPage').then(module => ({ default: module.PublicEventDetailPage })))
const PublicPartnersBundlesPage = lazy(() => import('./pages/PublicPartnersBundlesPage').then(module => ({ default: module.PublicPartnersBundlesPage })))
const PublicPlansPage = lazy(() => import('./pages/PublicPlansPage').then(module => ({ default: module.PublicPlansPage })))
const PublicPortalPage = lazy(() => import('./pages/PublicPortalPage').then(module => ({ default: module.PublicPortalPage })))
const PublicSearchPage = lazy(() => import('./pages/PublicSearchPage').then(module => ({ default: module.PublicSearchPage })))
const SmartFarmCheckinPage = lazy(() => import('./pages/SmartFarmCheckinPage').then(module => ({ default: module.SmartFarmCheckinPage })))

const pathname = window.location.pathname
const publicCertificateRoute = pathname === '/certificates/validate'
const smartFarmCheckinRoute = pathname === '/smart-farm/checkin'
const workspaceRoute = pathname === '/app' || pathname.startsWith('/app/')
const publicSearchRoute = pathname === '/search'
const publicEventDetailRoute = /^\/events\/[^/]+$/.test(pathname)
const publicPartnersBundlesRoute = pathname === '/partners' || pathname.startsWith('/partners/') || pathname === '/bundles' || pathname.startsWith('/bundles/')
const publicPlansRoute = pathname === '/plans' || pathname.startsWith('/plans/')
const publicDiscoveryRoute = pathname === '/paths' || pathname.startsWith('/paths/') || pathname === '/instructors' || pathname.startsWith('/instructors/')

if (workspaceRoute || publicCertificateRoute || smartFarmCheckinRoute || publicSearchRoute) {
  applyPublicSeo({
    title: workspaceRoute ? 'iFarm Academy' : publicCertificateRoute ? 'Validar certificado · iFarm Academy' : smartFarmCheckinRoute ? 'Check-in · iFarm Academy' : 'Busca · iFarm Academy',
    description: 'iFarm Academy — educação conectada ao ecossistema iFarm.',
    canonicalPath: pathname,
    index: false,
  })
} else {
  const detail = pathname.split('/').filter(Boolean).length > 1
  const section = pathname.startsWith('/courses') ? 'Cursos' : pathname.startsWith('/paths') ? 'Trilhas' : pathname.startsWith('/instructors') ? 'Instrutores' : pathname.startsWith('/events') ? 'Eventos' : pathname.startsWith('/plans') ? 'Planos' : pathname.startsWith('/partners') ? 'Parceiros' : pathname.startsWith('/bundles') ? 'Bundles' : 'iFarm Academy'
  applyPublicSeo({
    title: section === 'iFarm Academy' ? 'iFarm Academy — Educação para o agro' : `${section} · iFarm Academy`,
    description: detail ? `Conheça este conteúdo publicado na iFarm Academy.` : `${section} publicados na iFarm Academy, integrados ao ecossistema iFarm.`,
    canonicalPath: pathname,
    index: true,
  })
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SkipToContent />
    <Suspense fallback={<RouteLoading />}>
      {publicCertificateRoute
        ? <PublicCertificateValidationPage />
        : smartFarmCheckinRoute
          ? <AcademySessionGate><SmartFarmCheckinPage /></AcademySessionGate>
          : workspaceRoute
            ? <AcademySessionGate><AcademyWorkspacePage /></AcademySessionGate>
            : publicSearchRoute
              ? <PublicSearchPage />
              : publicEventDetailRoute
                ? <PublicEventDetailPage />
                : publicPartnersBundlesRoute
                  ? <PublicPartnersBundlesPage />
                  : publicPlansRoute
                    ? <PublicPlansPage />
                    : publicDiscoveryRoute
                      ? <PublicDiscoveryPage />
                      : <PublicPortalPage />}
    </Suspense>
  </React.StrictMode>,
)
