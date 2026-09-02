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

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`Academy API ${response.status}: ${await response.text()}`)
  return response.json() as Promise<T>
}

export async function reserveMaterial(input: {
  courseId: string
  lessonId: string
  fileName: string
  mimeType: string
  sizeBytes: number
}): Promise<MaterialReservation> {
  const result = await jsonRequest<{ data: MaterialReservation }>('/api/materials', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return result.data
}

export async function uploadReservedMaterial(reservation: MaterialReservation, file: File) {
  if (!reservation.storageConfigured) {
    throw new Error('Storage da Academy ainda não foi provisionado neste ambiente.')
  }

  const response = await fetch(reservation.uploadUrl, {
    method: 'PUT',
    headers: {
      'content-type': reservation.mimeType,
      'x-ifarm-file-size': String(file.size),
    },
    body: file,
  })
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
