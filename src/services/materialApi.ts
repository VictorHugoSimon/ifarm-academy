import { authenticatedFetch, authenticatedJson } from './authenticatedFetch'

export interface MaterialReservation {
  id: string
  courseId: string
  lessonId: string
  fileName: string
  mimeType: string
  sizeBytes: number
  provider: 'academy_storage'
  status: 'pending'
  uploadUrl: string
  storageConfigured: boolean
}

export async function reserveMaterial(input: {
  courseId: string
  lessonId: string
  fileName: string
  mimeType: string
  sizeBytes: number
}): Promise<MaterialReservation> {
  const result = await authenticatedJson<{ data: MaterialReservation }>('/api/materials', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  return result.data
}

export async function uploadReservedMaterial(reservation: MaterialReservation, file: File) {
  if (!reservation.storageConfigured) {
    throw new Error('Storage da Academy ainda não foi provisionado neste ambiente.')
  }

  const uploadUrl = new URL(reservation.uploadUrl, window.location.origin)
  const init: RequestInit = {
    method: 'PUT',
    headers: {
      'content-type': reservation.mimeType,
      'x-ifarm-file-size': String(file.size),
    },
    body: file,
  }
  const response = uploadUrl.origin === window.location.origin
    ? await authenticatedFetch(uploadUrl, init)
    : await fetch(uploadUrl, init)

  if (!response.ok) throw new Error(`Academy API ${response.status}: ${await response.text()}`)
  return response.json() as Promise<{ data: {
    id: string
    status: 'ready'
    provider: 'academy_storage'
    providerRef: string
    fileName: string
    mimeType: string
    sizeBytes: number
  } }>
}

export async function uploadLessonMaterial(input: {
  courseId: string
  lessonId: string
  file: File
}) {
  const reservation = await reserveMaterial({
    courseId: input.courseId,
    lessonId: input.lessonId,
    fileName: input.file.name,
    mimeType: input.file.type || 'application/octet-stream',
    sizeBytes: input.file.size,
  })
  return uploadReservedMaterial(reservation, input.file)
}
