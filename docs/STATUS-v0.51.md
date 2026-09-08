# STATUS — iFarm Academy v0.51

## Objetivo
Melhorar a resiliência da sessão Neon/iFarm Core e alinhar a navegação do workspace ao contexto de privilégio já validado pelo backend.

## Concluído
- `authenticatedFetch` sinaliza sessão expirada quando não há token ou quando uma API protegida retorna `401`;
- `AcademySessionGate` encerra a sessão local e exige novo login após expiração;
- snapshot validado pelo Core é compartilhado por `AcademySessionProvider`;
- operações administrativas evidentes só aparecem para `owner`, `tenant_admin` ou `ifarm_admin` quando MFA aplicável estiver satisfeito;
- aba `Operações` permanece exclusiva de `ifarm_admin` com MFA satisfeito;
- usuários comuns entram diretamente no catálogo em vez do Course Builder.

## Segurança
A navegação é apenas UX. O backend continua sendo a autoridade de autorização e tenant. Ocultar uma aba não concede nem remove permissão server-side.

## Testes
- status `401` é o único classificado como expiração de sessão;
- papel comum não é elevado;
- owner/tenant_admin respeitam MFA;
- operações globais exigem `ifarm_admin` + MFA quando requerido.

## Próximo passo
Homologar a sessão real em STAGE e testar login, expiração, troca de tenant, MFA e isolamento de dados com recursos exclusivos da Academy.
