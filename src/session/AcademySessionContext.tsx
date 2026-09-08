import { createContext, useContext, type ReactNode } from 'react'
import type { CoreSessionSnapshot } from '../services/coreSessionApi'

const ENTERPRISE_MANAGEMENT_PERMISSIONS = ['organization.manage', 'user.manage', 'notification.manage'] as const

export interface AcademySessionAccess {
  snapshot: CoreSessionSnapshot
  academyAdmin: boolean
  enterpriseManager: boolean
  ifarmOperations: boolean
}

const AcademySessionContext = createContext<AcademySessionAccess | null>(null)

function hasPermissions(snapshot: CoreSessionSnapshot, required: readonly string[]) {
  const granted = new Set((snapshot.permissions ?? []).map((permission) => permission.trim().toLowerCase()))
  return required.every((permission) => granted.has(permission))
}

export function deriveAcademySessionAccess(snapshot: CoreSessionSnapshot): AcademySessionAccess {
  const role = snapshot.role?.trim().toLowerCase() ?? ''
  const privilegedRole = role === 'owner' || role === 'tenant_admin'
  const mfaSatisfied = !snapshot.mfa.required || snapshot.mfa.satisfied
  return {
    snapshot,
    academyAdmin: mfaSatisfied && (snapshot.ifarmAdmin || privilegedRole),
    enterpriseManager: mfaSatisfied && hasPermissions(snapshot, ENTERPRISE_MANAGEMENT_PERMISSIONS),
    ifarmOperations: mfaSatisfied && snapshot.ifarmAdmin,
  }
}

export function AcademySessionProvider({ snapshot, children }: { snapshot: CoreSessionSnapshot; children: ReactNode }) {
  return (
    <AcademySessionContext.Provider value={deriveAcademySessionAccess(snapshot)}>
      {children}
    </AcademySessionContext.Provider>
  )
}

export function useAcademySession(): AcademySessionAccess {
  const value = useContext(AcademySessionContext)
  if (!value) throw new Error('AcademySessionProvider ausente no workspace protegido.')
  return value
}
