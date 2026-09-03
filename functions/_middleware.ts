import {
  enforceRateLimit,
  recordOperationalEvent,
  resolveRequestId,
  resolveRouteScope,
  structuredLog,
} from './api/_operations'
import { json, type Env } from './api/_shared'

export const onRequest = async (context: {
  env: Env
  request: Request
  next: () => Promise<Response>
}) => {
  const requestId = resolveRequestId(context.request)
  const startedAt = Date.now()
  const url = new URL(context.request.url)
  const routeScope = resolveRouteScope(context.request)

  let response: Response
  try {
    const limited = await enforceRateLimit(context.env, context.request, requestId)
    response = limited ?? await context.next()
  } catch (error) {
    structuredLog('error', {
      event: 'request_failed_unhandled',
      requestId,
      method: context.request.method,
      path: url.pathname,
      routeScope,
      durationMs: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : 'unknown_error',
    })
    await recordOperationalEvent(context.env, {
      requestId,
      eventType: 'dependency_unavailable',
      severity: 'error',
      component: 'request_pipeline',
      routeScope,
      statusCode: 500,
      detailCode: 'unhandled_request_failure',
    })
    response = json({ error: 'Erro interno da Academy.', requestId }, 500)
  }

  const headers = new Headers(response.headers)
  headers.set('x-request-id', requestId)
  headers.set('x-content-type-options', 'nosniff')
  headers.set('referrer-policy', 'same-origin')
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(self)')

  structuredLog(response.status >= 500 ? 'error' : response.status >= 400 ? 'warn' : 'info', {
    event: 'request_completed',
    requestId,
    method: context.request.method,
    path: url.pathname,
    routeScope,
    status: response.status,
    durationMs: Date.now() - startedAt,
    environment: context.env.ACADEMY_ENVIRONMENT ?? 'unknown',
    release: context.env.ACADEMY_RELEASE ?? 'unknown',
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
