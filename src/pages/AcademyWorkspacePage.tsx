import { useEffect, useState } from 'react'
import { useAcademySession } from '../session/AcademySessionContext'
import { CourseBuilderPage } from './CourseBuilderPage'
import { QuizBuilderPage } from './QuizBuilderPage'
import { StudentAssessmentPlayerPage } from './StudentAssessmentPlayerPage'
import { AssessmentReviewPage } from './AssessmentReviewPage'
import { CertificateEligibilityPage } from './CertificateEligibilityPage'
import { CertificateValidityGovernancePage } from './CertificateValidityGovernancePage'
import { CommercialEnginePage } from './CommercialEnginePage'
import { CommercialPrivacyPage } from './CommercialPrivacyPage'
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

type WorkspaceView = 'course' | 'quiz' | 'publication' | 'public-portal' | 'public-discovery' | 'plans' | 'commercial' | 'commercial-privacy' | 'catalog' | 'enterprise' | 'enterprise-paths' | 'events' | 'smart-farm' | 'marketplace' | 'white-label' | 'instructors' | 'reports' | 'operations' | 'certificate-validity' | 'student' | 'gamification' | 'notifications' | 'review' | 'certificate'

const tabs: Array<[WorkspaceView, string]> = [
  ['course', 'Course Builder'],
  ['quiz', 'Quiz Builder'],
  ['publication', 'Publicação'],
  ['public-portal', 'Portal Público'],
  ['public-discovery', 'Trilhas & Instrutores Públicos'],
  ['plans', 'Planos & Ofertas'],
  ['commercial', 'Motor Comercial'],
  ['commercial-privacy', 'Privacidade comercial'],
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

const academyAdminViews = new Set<WorkspaceView>([
  'course', 'quiz', 'publication', 'public-portal', 'public-discovery', 'plans',
  'commercial', 'white-label', 'instructors', 'certificate-validity', 'review',
])

export function AcademyWorkspacePage() {
  const { academyAdmin, ifarmOperations } = useAcademySession()
  const [view, setView] = useState<WorkspaceView>(() => academyAdmin ? 'course' : 'catalog')
  const [runtimeBrand, setRuntimeBrand] = useState<WhiteLabelBrand | null>(null)

  function canView(candidate: WorkspaceView) {
    if (candidate === 'operations') return ifarmOperations
    if (academyAdminViews.has(candidate)) return academyAdmin
    return true
  }

  useEffect(() => {
    if (!canView(view)) setView('catalog')
  }, [view, academyAdmin, ifarmOperations])

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
          <p className="workspaceIntro">Criação, avaliação, publicação, portal público, trilhas, instrutores, planos, motor comercial consentido, privacidade comercial, matrícula, educação corporativa, eventos, Smart Farm Experience, marketplace, white label, governança técnica, relatórios, observabilidade, experiência do aluno, gamificação, notificações, revisão e certificação no mesmo fluxo.</p>
        </div>
      </div>

      <nav className="workspaceTabs" aria-label="Fluxo acadêmico">
        {tabs.filter(([id]) => canView(id)).map(([id, label]) => (
          <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}</button>
        ))}
      </nav>

      {view === 'course' && <CourseBuilderPage onBack={() => setView('course')} />}
      {view === 'quiz' && <QuizBuilderPage />}
      {view === 'publication' && <CoursePublicationPage />}
      {view === 'public-portal' && <PublicPortalGovernancePage />}
      {view === 'public-discovery' && <PublicDiscoveryGovernancePage />}
      {view === 'plans' && <PlansGovernancePage />}
      {view === 'commercial' && <CommercialEnginePage />}
      {view === 'commercial-privacy' && <CommercialPrivacyPage />}
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
