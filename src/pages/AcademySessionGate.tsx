import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { authClient, authConfigured } from '../services/authClient'
import { activateCoreTenant, loadCoreSession, type CoreSessionSnapshot } from '../services/coreSessionApi'

export function AcademySessionGate({ children }: { children: ReactNode }) {
  const session = authClient.useSession()
  const [snapshot, setSnapshot] = useState<CoreSessionSnapshot | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loadingContext, setLoadingContext] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [switchingTenant, setSwitchingTenant] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refreshContext() {
    setLoadingContext(true)
    setError(null)
    try {
      setSnapshot(await loadCoreSession())
    } catch (cause) {
      setSnapshot(null)
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a sessão iFarm.')
    } finally {
      setLoadingContext(false)
    }
  }

  useEffect(() => {
    if (session.data) void refreshContext()
    else setSnapshot(null)
  }, [session.data])

  const activeTenants = useMemo(
    () => snapshot?.tenants.filter((tenant) => tenant.active) ?? [],
    [snapshot],
  )

  async function submitLogin(event: FormEvent) {
    event.preventDefault()
    setSigningIn(true)
    setError(null)
    try {
      const result = await authClient.signIn.email({ email, password })
      if (result.error) throw new Error(result.error.message || 'Falha na autenticação.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha na autenticação.')
    } finally {
      setSigningIn(false)
    }
  }

  async function changeTenant(tenantId: string) {
    if (!tenantId || tenantId === snapshot?.tenantId) return
    setSwitchingTenant(true)
    setError(null)
    try {
      await activateCoreTenant(tenantId)
      window.location.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível alterar a empresa ativa.')
      setSwitchingTenant(false)
    }
  }

  async function signOut() {
    await authClient.signOut()
    setSnapshot(null)
    window.location.replace('/app')
  }

  if (!authConfigured) {
    return (
      <main className="academyAuthPage">
        <section className="academyAuthCard">
          <div className="academyAuthBrand">iFarm <span>Academy AI</span></div>
          <p className="academyAuthEyebrow">IDENTIDADE CENTRAL IFARM</p>
          <h1>Integração de sessão não configurada</h1>
          <p>Defina <code>VITE_NEON_AUTH_URL</code> no ambiente da Academy. Nenhum login local alternativo será criado.</p>
        </section>
      </main>
    )
  }

  if (session.isPending) return <div className="academySessionState">Carregando sessão segura…</div>

  if (!session.data) {
    return (
      <main className="academyAuthPage">
        <section className="academyAuthCard">
          <div className="academyAuthBrand">iFarm <span>Academy AI</span></div>
          <p className="academyAuthEyebrow">ACESSO INTEGRADO</p>
          <h1>Entrar na iFarm Academy</h1>
          <p>Use a mesma identidade do ecossistema iFarm. A Academy não mantém usuário ou senha paralelos.</p>
          <form onSubmit={submitLogin} className="academyAuthForm">
            <label>E-mail<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Senha<input type="password" required minLength={8} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            {error && <div className="academyAuthError">{error}</div>}
            <button type="submit" disabled={signingIn}>{signingIn ? 'Entrando…' : 'Entrar com iFarm'}</button>
          </form>
        </section>
      </main>
    )
  }

  if (loadingContext && !snapshot) return <div className="academySessionState">Validando empresa, perfil e permissões no iFarm Core…</div>

  if (!snapshot) {
    return (
      <main className="academyAuthPage">
        <section className="academyAuthCard">
          <div className="academyAuthBrand">iFarm <span>Academy AI</span></div>
          <h1>Sessão iFarm indisponível</h1>
          {error && <div className="academyAuthError">{error}</div>}
          <div className="academyAuthActions">
            <button onClick={() => void refreshContext()}>Tentar novamente</button>
            <button className="secondary" onClick={() => void signOut()}>Sair</button>
          </div>
        </section>
      </main>
    )
  }

  if (!snapshot.tenantId) {
    return (
      <main className="academyAuthPage">
        <section className="academyAuthCard">
          <div className="academyAuthBrand">iFarm <span>Academy AI</span></div>
          <p className="academyAuthEyebrow">CONTEXTO MULTIEMPRESA</p>
          <h1>Selecione a empresa</h1>
          <p>A empresa ativa é definida no iFarm Core e passa a ser a única fonte de tenant para a Academy.</p>
          {activeTenants.length > 0 ? (
            <div className="academyTenantGrid">
              {activeTenants.map((tenant) => (
                <button key={tenant.id} disabled={switchingTenant} onClick={() => void changeTenant(tenant.id)}>
                  <strong>{tenant.tradeName || tenant.legalName}</strong>
                  <span>{tenant.role || 'membro'} · {tenant.slug}</span>
                </button>
              ))}
            </div>
          ) : <div className="academyAuthError">Sua identidade não possui membership ativa em nenhum tenant do iFarm Core.</div>}
          {error && <div className="academyAuthError">{error}</div>}
          <button className="academyStandaloneSecondary" onClick={() => void signOut()}>Sair</button>
        </section>
      </main>
    )
  }

  const currentTenant = snapshot.tenants.find((tenant) => tenant.id === snapshot.tenantId)
  const userLabel = session.data.user.name || session.data.user.email

  return (
    <div className="academyAuthenticatedShell">
      <header className="academySessionBar">
        <div>
          <span className="academySessionLabel">Empresa</span>
          <select
            aria-label="Empresa ativa"
            value={snapshot.tenantId}
            disabled={switchingTenant}
            onChange={(event) => void changeTenant(event.target.value)}
          >
            {activeTenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>{tenant.tradeName || tenant.legalName}</option>
            ))}
          </select>
        </div>
        <div className="academySessionIdentity">
          <div>
            <strong>{userLabel}</strong>
            <span>{snapshot.ifarmAdmin ? 'Administrador iFarm' : snapshot.role || currentTenant?.role || 'Usuário iFarm'}</span>
          </div>
          <button onClick={() => void signOut()}>Sair</button>
        </div>
      </header>
      {snapshot.mfa.required && !snapshot.mfa.satisfied && (
        <div className="academyMfaWarning">Este perfil exige MFA. Operações privilegiadas permanecem bloqueadas até o segundo fator ser validado no iFarm Core.</div>
      )}
      {error && <div className="academyInlineError">{error}</div>}
      {children}
    </div>
  )
}
