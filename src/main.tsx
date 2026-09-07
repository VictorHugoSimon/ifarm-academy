import React from 'react'
import { createRoot } from 'react-dom/client'
import { AcademyWorkspacePage } from './pages/AcademyWorkspacePage'
import { PublicCertificateValidationPage } from './pages/PublicCertificateValidationPage'
import { PublicDiscoveryPage } from './pages/PublicDiscoveryPage'
import { PublicPlansPage } from './pages/PublicPlansPage'
import { PublicPortalPage } from './pages/PublicPortalPage'
import { SmartFarmCheckinPage } from './pages/SmartFarmCheckinPage'
import './styles/runtime.css'
import './styles/course-builder.css'
import './styles/quiz-player.css'
import './styles/assessment-cert.css'

const pathname = window.location.pathname
const publicCertificateRoute = pathname === '/certificates/validate'
const smartFarmCheckinRoute = pathname === '/smart-farm/checkin'
const workspaceRoute = pathname === '/app' || pathname.startsWith('/app/')
const publicPlansRoute = pathname === '/plans' || pathname.startsWith('/plans/')
const publicDiscoveryRoute = pathname === '/paths' || pathname.startsWith('/paths/') || pathname === '/instructors' || pathname.startsWith('/instructors/')

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {publicCertificateRoute
      ? <PublicCertificateValidationPage />
      : smartFarmCheckinRoute
        ? <SmartFarmCheckinPage />
        : workspaceRoute
          ? <AcademyWorkspacePage />
          : publicPlansRoute
            ? <PublicPlansPage />
            : publicDiscoveryRoute
              ? <PublicDiscoveryPage />
              : <PublicPortalPage />}
  </React.StrictMode>,
)
