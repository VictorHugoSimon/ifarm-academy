import { useState } from 'react'
import { CourseBuilderPage } from './CourseBuilderPage'
import { QuizBuilderPage } from './QuizBuilderPage'
import { StudentAssessmentPlayerPage } from './StudentAssessmentPlayerPage'
import { AssessmentReviewPage } from './AssessmentReviewPage'
import { CertificateEligibilityPage } from './CertificateEligibilityPage'
import { CertificateValidityGovernancePage } from './CertificateValidityGovernancePage'
import { CoursePublicationPage } from './CoursePublicationPage'
import { EnrollmentCatalogPage } from './EnrollmentCatalogPage'
import { EnterpriseTrainingPage } from './EnterpriseTrainingPage'
import { EnterprisePathsPage } from './EnterprisePathsPage'
import { EventOperationsPage } from './EventOperationsPage'
import { InstructorGovernancePage } from './InstructorGovernancePage'
import { OperationsPage } from './OperationsPage'
import { ReportsPage } from './ReportsPage'
import { SmartFarmExperiencePage } from './SmartFarmExperiencePage'
import '../styles/assessment-cert.css'
import '../styles/lesson-content.css'

type WorkspaceView = 'course' | 'quiz' | 'publication' | 'catalog' | 'enterprise' | 'enterprise-paths' | 'events' | 'smart-farm' | 'instructors' | 'reports' | 'operations' | 'certificate-validity' | 'student' | 'review' | 'certificate'

const tabs: Array<[WorkspaceView, string]> = [
  ['course', 'Course Builder'],
  ['quiz', 'Quiz Builder'],
  ['publication', 'Publicação'],
  ['catalog', 'Catálogo e matrículas'],
  ['enterprise', 'Área empresarial'],
  ['enterprise-paths', 'Trilhas empresariais'],
  ['events', 'Eventos'],
  ['smart-farm', 'Smart Farm Experience'],
  ['instructors', 'Instrutores'],
  ['reports', 'Relatórios'],
  ['operations', 'Operações'],
  ['certificate-validity', 'Validade certificados'],
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
          <h1>Operação integrada da Academy</h1>
          <p className="workspaceIntro">Criação, avaliação, publicação, matrícula, educação corporativa, trilhas, eventos, Smart Farm Experience, instrutores, governança de certificados, relatórios, observabilidade, experiência do aluno, revisão e certificação no mesmo fluxo.</p>
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
      {view === 'enterprise' && <EnterpriseTrainingPage />}
      {view === 'enterprise-paths' && <EnterprisePathsPage />}
      {view === 'events' && <EventOperationsPage />}
      {view === 'smart-farm' && <SmartFarmExperiencePage />}
      {view === 'instructors' && <InstructorGovernancePage />}
      {view === 'reports' && <ReportsPage />}
      {view === 'operations' && <OperationsPage />}
      {view === 'certificate-validity' && <CertificateValidityGovernancePage />}
      {view === 'student' && <StudentAssessmentPlayerPage />}
      {view === 'review' && <AssessmentReviewPage />}
      {view === 'certificate' && <CertificateEligibilityPage />}
    </div>
  )
}
