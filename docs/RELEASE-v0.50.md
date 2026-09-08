# RELEASE — iFarm Academy v0.50.0

A v0.50 conclui a migração do frontend protegido para a sessão Neon Auth/iFarm Core sem depender de interceptor global de `fetch`.

Enterprise e Motor Comercial agora usam transporte autenticado explícito. Com isso, o workspace não precisa mais sobrescrever `globalThis.fetch` para inserir Bearer nas chamadas `/api/*`.

## Segurança
- tenant continua sendo resolvido pelo iFarm Core;
- Bearer é usado apenas por chamadas protegidas que declaram o transporte autenticado;
- superfícies públicas continuam anônimas;
- nenhum secret/token real foi versionado.

## Gate
Merge apenas com CI integralmente verde: typecheck, testes, migrations/fixtures e build.
