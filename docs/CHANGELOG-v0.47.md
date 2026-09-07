# CHANGELOG — v0.47.0

## Added
- `AcademySessionGate` para sessão integrada ao iFarm Core.
- `coreSessionApi` e `/api/core-session` para bootstrap/troca de tenant.
- `workspaceApiTransport` para autenticar chamadas `/api/*` do workspace.
- UI de seleção de empresa, logout e aviso de MFA.
- testes de transporte, bootstrap e bypass seguro do middleware.

## Changed
- `authenticatedFetch` agora falha fechado sem Bearer e usa fetch nativo capturado para evitar recursão.
- middleware Core permite apenas o bootstrap `/api/core-session` antes de tenant ativo, sempre removendo headers internos do cliente.
- `.env.example` e `wrangler.stage.example.toml` alinhados ao contrato Neon/Core atual.
- versão do pacote: `0.47.0`.

## Security
- nenhuma autoridade de tenant é derivada de parâmetro/header confiado do browser;
- nenhum secret ou token real versionado;
- troca de tenant permanece autoridade exclusiva do iFarm Core.
