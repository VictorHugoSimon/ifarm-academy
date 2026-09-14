import React from 'react'
import { createRoot } from 'react-dom/client'
import { AcademySessionGate } from './pages/AcademySessionGate'
import { AcademyWorkspacePage } from './pages/AcademyWorkspacePage'
import { PublicCertificateValidationPage } from './pages/PublicCertificateValidationPage'
import { PublicDiscoveryPage } from './pages/PublicDiscoveryPage'
import { PublicEventDetailPage } from './pages/PublicEventDetailPage'
import { PublicPartnersBundlesPage } from './pages/PublicPartnersBundlesPage'
import { PublicPlansPage } from './pages/PublicPlansPage'
import { PublicPortalPage } from './pages/PublicPortalPage'
import { PublicSearchPage } from './pages/PublicSearchPage'
import { SmartFarmCheckinPage } from './pages/SmartFarmCheckinPage'
import { applyPublicSeo } from './services/publicSeo'
import './styles/runtime.css'
import './styles/course-builder.css'
import './styles/quiz-player.css'
import './styles/assessment-cert.css'
import './styles/session.css'

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
  </React.StrictMode>,
)
