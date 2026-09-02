import { useState } from 'react'
import { CourseBuilderPage } from './CourseBuilderPage'
import { QuizBuilderPage } from './QuizBuilderPage'
import { StudentAssessmentPlayerPage } from './StudentAssessmentPlayerPage'
import { AssessmentReviewPage } from './AssessmentReviewPage'
import { CertificateEligibilityPage } from './CertificateEligibilityPage'
import { CoursePublicationPage } from './CoursePublicationPage'
import { EnrollmentCatalogPage } from './EnrollmentCatalogPage'
import '../styles/assessment-cert.css'

type WorkspaceView = 'course' | 'quiz' | 'publication' | 'catalog' | 'student' | 'review' | 'certificate'

const tabs: Array<[WorkspaceView, string]> = [
  ['course', 'Course Builder'],
  ['quiz', 'Quiz Builder'],
  ['publication', 'Publicação'],
  ['catalog', 'Catálogo e matrículas'],
  ['student', 'Experiência do aluno'],
  ['review', 'Revisão manual'],
  ['certificate', 'Certificação'],
]

export function AcademyWorkspacePage() {
  const [view, setView] = useState<WorkspaceView>('course')

  return (
    <div className="academyWorkspace">
      <div className="workspaceHeader">
        <div>
          <small>iFarm Academy · Núcleo acadêmico</small>
          <h1>Operação integrada do curso</h1>
          <p className="workspaceIntro">Criação, avaliação, governança de publicação, matrícula, experiência do aluno, revisão e certificação no mesmo fluxo.</p>
        </div>
      </div>

      <nav className="workspaceTabs" aria-label="Fluxo acadêmico">
        {tabs.map(([id, label]) => (
          <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}</button>
        ))}
      </nav>

      {view === 'course' && <CourseBuilderPage onBack={() => setView('course')} />}
      {view === 'quiz' && <QuizBuilderPage />}
      {view === 'publication' && <CoursePublicationPage />}
      {view === 'catalog' && <EnrollmentCatalogPage />}
      {view === 'student' && <StudentAssessmentPlayerPage />}
      {view === 'review' && <AssessmentReviewPage />}
      {view === 'certificate' && <CertificateEligibilityPage />}
    </div>
  )
}
