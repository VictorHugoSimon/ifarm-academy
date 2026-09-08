import { createContext, useContext, type ReactNode } from 'react'
import type { CoreSessionSnapshot } from '../services/coreSessionApi'

export interface AcademySessionAccess {
  snapshot: CoreSessionSnapshot
  academyAdmin: boolean
  ifarmOperations: boolean
}

const AcademySessionContext = createContext<AcademySessionAccess | null>(null)

export function deriveAcademySessionAccess(snapshot: CoreSessionSnapshot): AcademySessionAccess {
  const role = snapshot.role?.trim().toLowerCase() ?? ''
  const privilegedRole = role === 'owner' || role === 'tenant_admin'
  const mfaSatisfied = !snapshot.mfa.required || snapshot.mfa.satisfied
  return {
    snapshot,
    academyAdmin: mfaSatisfied && (snapshot.ifarmAdmin || privilegedRole),
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
