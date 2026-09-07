import { useEffect, useState } from 'react'
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
import { GamificationPage } from './GamificationPage'
import { InstructorGovernancePage } from './InstructorGovernancePage'
import { MarketplacePage } from './MarketplacePage'
import { NotificationCenterPage } from './NotificationCenterPage'
import { OperationsPage } from './OperationsPage'
import { PlansGovernancePage } from './PlansGovernancePage'
import { PublicDiscoveryGovernancePage } from './PublicDiscoveryGovernancePage'
import { PublicPortalGovernancePage } from './PublicPortalGovernancePage'
import { ReportsPage } from './ReportsPage'
import { SmartFarmExperiencePage } from './SmartFarmExperiencePage'
import { WhiteLabelPage } from './WhiteLabelPage'
import { loadWhiteLabelContext, type WhiteLabelBrand } from '../services/whiteLabelApi'
import '../styles/assessment-cert.css'
import '../styles/lesson-content.css'

type WorkspaceView = 'course' | 'quiz' | 'publication' | 'public-portal' | 'public-discovery' | 'plans' | 'catalog' | 'enterprise' | 'enterprise-paths' | 'events' | 'smart-farm' | 'marketplace' | 'white-label' | 'instructors' | 'reports' | 'operations' | 'certificate-validity' | 'student' | 'gamification' | 'notifications' | 'review' | 'certificate'

const tabs: Array<[WorkspaceView, string]> = [
  ['course', 'Course Builder'],
  ['quiz', 'Quiz Builder'],
  ['publication', 'Publicação'],
  ['public-portal', 'Portal Público'],
  ['public-discovery', 'Trilhas & Instrutores Públicos'],
  ['plans', 'Planos & Ofertas'],
  ['catalog', 'Catálogo e matrículas'],
  ['enterprise', 'Área empresarial'],
  ['enterprise-paths', 'Trilhas empresariais'],
  ['events', 'Eventos'],
  ['smart-farm', 'Smart Farm Experience'],
  ['marketplace', 'Marketplace'],
  ['white-label', 'White Label'],
  ['instructors', 'Instrutores'],
  ['reports', 'Relatórios'],
  ['operations', 'Operações'],
  ['certificate-validity', 'Validade certificados'],
  ['student', 'Experiência do aluno'],
  ['gamification', 'Gamificação'],
  ['notifications', 'Notificações'],
  ['review', 'Revisão manual'],
  ['certificate', 'Certificação'],
]

export function AcademyWorkspacePage() {
  const [view, setView] = useState<WorkspaceView>('course')
  const [runtimeBrand, setRuntimeBrand] = useState<WhiteLabelBrand | null>(null)

  useEffect(() => {
    void loadWhiteLabelContext().then((brand) => {
      setRuntimeBrand(brand)
      document.title = brand.academyName
    }).catch(() => undefined)
  }, [view])

  return (
    <div className="academyWorkspace">
      <div className="workspaceHeader">
        <div>
          <small>{runtimeBrand?.academyName || 'iFarm Academy'} · Núcleo acadêmico</small>
          <h1>Operação integrada da Academy</h1>
          <p className="workspaceIntro">Criação, avaliação, publicação, portal público, trilhas, instrutores, planos e ofertas, matrícula, educação corporativa, eventos, Smart Farm Experience, marketplace, white label, governança técnica, relatórios, observabilidade, experiência do aluno, gamificação, notificações, revisão e certificação no mesmo fluxo.</p>
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
      {view === 'public-portal' && <PublicPortalGovernancePage />}
      {view === 'public-discovery' && <PublicDiscoveryGovernancePage />}
      {view === 'plans' && <PlansGovernancePage />}
      {view === 'catalog' && <EnrollmentCatalogPage />}
      {view === 'enterprise' && <EnterpriseTrainingPage />}
      {view === 'enterprise-paths' && <EnterprisePathsPage />}
      {view === 'events' && <EventOperationsPage />}
      {view === 'smart-farm' && <SmartFarmExperiencePage />}
      {view === 'marketplace' && <MarketplacePage />}
      {view === 'white-label' && <WhiteLabelPage />}
      {view === 'instructors' && <InstructorGovernancePage />}
      {view === 'reports' && <ReportsPage />}
      {view === 'operations' && <OperationsPage />}
      {view === 'certificate-validity' && <CertificateValidityGovernancePage />}
      {view === 'student' && <StudentAssessmentPlayerPage />}
      {view === 'gamification' && <GamificationPage />}
      {view === 'notifications' && <NotificationCenterPage />}
      {view === 'review' && <AssessmentReviewPage />}
      {view === 'certificate' && <CertificateEligibilityPage />}
    </div>
  )
}
