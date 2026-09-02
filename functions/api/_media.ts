export interface MediaContent {
  provider?: string
  providerRef?: string
  externalUrl?: string
}

export interface MediaPlaybackDescriptor {
  mode: 'direct' | 'provider_pending'
  provider: string
  providerRef?: string
  playbackUrl?: string
}

export function safePlaybackUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return url.toString()
  } catch {
    return null
  }
}

export function publicMediaContent(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const provider = typeof source.provider === 'string' ? source.provider.trim() : ''
  const providerRef = typeof source.providerRef === 'string' ? source.providerRef.trim() : ''
  return {
    ...(provider ? { provider } : {}),
    ...(providerRef ? { providerRef } : {}),
    hasPlaybackSource: Boolean(providerRef || safePlaybackUrl(source.externalUrl)),
  }
}

export function resolveMediaPlayback(value: unknown): MediaPlaybackDescriptor | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  const externalUrl = safePlaybackUrl(source.externalUrl)
  if (externalUrl) {
    return {
      mode: 'direct',
      provider: typeof source.provider === 'string' && source.provider.trim() ? source.provider.trim() : 'external',
      providerRef: typeof source.providerRef === 'string' && source.providerRef.trim() ? source.providerRef.trim() : undefined,
      playbackUrl: externalUrl,
    }
  }

  const providerRef = typeof source.providerRef === 'string' ? source.providerRef.trim() : ''
  if (providerRef) {
    return {
      mode: 'provider_pending',
      provider: typeof source.provider === 'string' && source.provider.trim() ? source.provider.trim() : 'academy_media',
      providerRef,
    }
  }

  return null
}
