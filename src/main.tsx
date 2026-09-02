import React from 'react'
import { createRoot } from 'react-dom/client'
import { AcademyWorkspacePage } from './pages/AcademyWorkspacePage'
import './styles/runtime.css'
import './styles/course-builder.css'
import './styles/quiz-player.css'
import './styles/assessment-cert.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AcademyWorkspacePage />
  </React.StrictMode>,
)
