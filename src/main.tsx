import React from 'react'
import { createRoot } from 'react-dom/client'
import { AcademyWorkspacePage } from './pages/AcademyWorkspacePage'
import { PublicCertificateValidationPage } from './pages/PublicCertificateValidationPage'
import { SmartFarmCheckinPage } from './pages/SmartFarmCheckinPage'
import './styles/runtime.css'
import './styles/course-builder.css'
import './styles/quiz-player.css'
import './styles/assessment-cert.css'

const pathname = window.location.pathname
const publicCertificateRoute = pathname === '/certificates/validate'
const smartFarmCheckinRoute = pathname === '/smart-farm/checkin'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {publicCertificateRoute
      ? <PublicCertificateValidationPage />
      : smartFarmCheckinRoute
        ? <SmartFarmCheckinPage />
        : <AcademyWorkspacePage />}
  </React.StrictMode>,
)
