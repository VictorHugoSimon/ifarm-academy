import React from 'react'
import { createRoot } from 'react-dom/client'
import { AcademyWorkspacePage } from './pages/AcademyWorkspacePage'
import { PublicCertificateValidationPage } from './pages/PublicCertificateValidationPage'
import './styles/runtime.css'
import './styles/course-builder.css'
import './styles/quiz-player.css'
import './styles/assessment-cert.css'

const publicCertificateRoute = window.location.pathname === '/certificates/validate'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {publicCertificateRoute ? <PublicCertificateValidationPage /> : <AcademyWorkspacePage />}
  </React.StrictMode>,
)
