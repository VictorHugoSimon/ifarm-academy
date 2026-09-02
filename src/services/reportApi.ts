export interface ReportWindow {
  from: string
  to: string
  label: string
}

export interface AcademicCourseReport {
  courseId: string
  courseTitle: string
  status: string
  certificateType: string
  cycles: number
  completedCycles: number
  completionRate: number
  certificates: number
  averageScore: number | null
}

export interface CompanyReport {
  companyId: string
  companyName: string
  status: string
  activeMembers: number
  assignments: number
  completedAssignments: number
  completionRate: number
  overdueAssignments: number
  pathAssignments: number
}

export interface EventReport {
  eventId: string
  title: string
  eventType: string
  modality: string
  accessModel: string
  startsAt: string
  endsAt: string
  capacity: number | null
  occupied: number
  occupancyRate: number | null
  waitlisted: number
  attended: number
  noShow: number
  smartFarmExperience: boolean
}

export interface TechnicalGovernanceCourseReport {
  courseId: string
  courseTitle: string
  status: string
  technicalResponsibles: number
  currentVerifiedResponsibles: number
  technicalGovernanceCovered: boolean
}

export interface AcademyReportResponse {
  generatedAt: string
  window: ReportWindow
  academic: {
    kpis: {
      publishedCourses: number
      learners: number
      activeCycles: number
      enrollmentsInPeriod: number
      completedCyclesInPeriod: number
      certificatesInPeriod: number
      assessmentApprovalRate: number
      averageAssessmentScore: number | null
    }
    courses: AcademicCourseReport[]
  }
  enterprise: {
    kpis: {
      activeCompanies: number
      activeMembers: number
      openAssignments: number
      overdueAssignments: number
      completedAssignmentsInPeriod: number
      completionRate: number
      renewalsDue: number
      renewalsUpcoming: number
    }
    companies: CompanyReport[]
  }
  events: {
    kpis: {
      upcomingEvents: number
      smartFarmUpcoming: number
      registrationsInPeriod: number
      currentWaitlist: number
      attendanceRate: number
      attendedInCompletedEvents: number
      noShowInCompletedEvents: number
    }
    events: EventReport[]
  }
  technicalGovernance: {
    kpis: {
      regulatoryCourses: number
      regulatoryCoursesMissingCurrentResponsible: number
      verifiedCurrentQualifications: number
      qualificationsExpiringIn30Days: number
      expiredQualifications: number
      activeVerifiedTechnicalResponsibilities: number
      regulatoryCertificatesInPeriod: number
    }
    courses: TechnicalGovernanceCourseReport[]
    disclaimer: string
  }
}

async function request<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`Academy API ${response.status}: ${await response.text()}`)
  return response.json() as Promise<T>
}

export async function loadAcademyReports(from?: string, to?: string): Promise<AcademyReportResponse> {
  const query = new URLSearchParams()
  if (from) query.set('from', from)
  if (to) query.set('to', to)
  const suffix = query.size ? `?${query.toString()}` : ''
  return request<AcademyReportResponse>(`/api/reports${suffix}`)
}

export function rowsToCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return ''
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  const escape = (value: unknown) => {
    if (value == null) return ''
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return [headers.join(','), ...rows.map((row) => headers.map((key) => escape(row[key])).join(','))].join('\n')
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const csv = rowsToCsv(rows)
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
