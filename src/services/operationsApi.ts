export interface HealthStatus {
  service: string
  status: string
  environment: string
  release: string
  timestamp: string
}

export interface ReadinessStatus {
  service: string
  status: 'ready' | 'not_ready'
  environment: string
  release: string
  timestamp: string
  checks: {
    database: boolean
    identityBoundary: boolean
    storage: boolean
  }
}

export interface OperationsStatus {
  generatedAt: string
  environment: string
  release: string
  rateLimiting: {
    enabled: boolean
    activeBucketsLast5Minutes: number
  }
  last24Hours: {
    grouped: Array<{ eventType: string; severity: string; total: number }>
    recent: Array<{
      requestId: string | null
      eventType: string
      severity: string
      component: string
      routeScope: string | null
      statusCode: number | null
      detailCode: string | null
      metadata: Record<string, unknown>
      createdAt: string
    }>
  }
}

async function request<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload && typeof payload.error === 'string' ? payload.error : `Academy API ${response.status}`
    throw new Error(message)
  }
  return payload as T
}

export function loadHealth() {
  return request<HealthStatus>('/api/health')
}

export function loadReadiness() {
  return request<ReadinessStatus>('/api/readiness')
}

export function loadOperationsStatus() {
  return request<OperationsStatus>('/api/operations-status')
}
