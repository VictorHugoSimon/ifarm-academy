# iFarm Academy — Integração com iFarm Core v0.46

## Objetivo

Eliminar a suposição de um SSO futuro abstrato e alinhar a Academy ao contrato executável atual do repositório `VictorHugoSimon/ifarm-core-platform`, inspecionado em modo somente leitura na branch `develop`.

A Academy não cria tabela paralela de identidade, senha, membership, tenant ou RBAC do Core.

## Fonte de verdade observada

O README do Core define o Core como dono de identidade, multiempresa, organizações, usuários, RBAC, notificações, auditoria, LGPD, contratos, configuração e integrações.

Há uma divergência documental importante:

- `docs/security/IDENTITY.md` ainda descreve Supabase Auth;
- o código executável atual de `develop` usa Neon Auth + Neon Data API;
- `apps/api/src/auth.ts` valida JWT por JWKS Neon e carrega contexto por `app_identity_context`;
- `apps/api/src/index.ts` declara `identityProvider: neon-auth`;
- `apps/web/src/auth-client.ts` usa `@neondatabase/auth@0.5.0-beta`.

Para esta integração, **código executável + migrations Neon atuais são a fonte de verdade**. A documentação antiga do Core deve ser tratada como dívida documental, não como contrato para a Academy.

## Contratos Core consumidos

A Academy v0.46 depende somente de endpoints públicos do contrato autenticado Core v1:

- `GET /api/v1/me`
- `GET /api/v1/me/permissions`

O Bearer token é o mesmo token de sessão Neon Auth usado pelo Core web.

`/api/v1/me` fornece, entre outros:

- `id`
- `tenantId`
- `membershipId`
- `roleId`
- `role`
- `ifarmAdmin`
- `mfa.required`
- `mfa.verified`
- `mfa.satisfied`
- `requestId`

`/api/v1/me/permissions` fornece a lista de permissões calculada pelo Core/RBAC.

## Fluxo de confiança

1. O navegador obtém a sessão Neon pelo mesmo cliente usado no Core web.
2. A chamada Academy protegida envia `Authorization: Bearer <token>`.
3. O middleware da Academy remove todos os headers `x-ifarm-*` recebidos do navegador.
4. O middleware consulta o Core com o Bearer original.
5. O Core valida JWT, tenant, membership, role e MFA.
6. A Academy recebe o contexto validado.
7. Somente então o middleware injeta headers internos para os endpoints legados da Academy.
8. O secret interno do bridge nunca é enviado ao browser.

Com `ACADEMY_CORE_API_URL` configurada, headers `x-ifarm-user-id`, `x-ifarm-tenant-id`, `x-ifarm-roles` e equivalentes enviados pelo cliente são ignorados/removidos.

## Tenant

A Academy não aceita tenant do visitante como autoridade.

O tenant usado em cada request autenticado vem de `/api/v1/me`, que por sua vez usa o contexto seguro do Core. Se o Core não retornar um tenant ativo, a Academy responde `TENANT_CONTEXT_REQUIRED` e não executa a operação.

A troca de tenant pertence ao Core (`POST /api/v1/me/active-tenant`) e será integrada no shell de sessão da próxima versão; a Academy não criará seletor que altere `tenant_id` diretamente no próprio banco.

## Papéis e MFA

A Academy não assume que qualquer papel Core é administrador Academy.

Projeção conservadora v0.46:

- `ifarmAdmin=true` + MFA satisfeito → `ifarm_admin` + `academy_admin`;
- Core `owner` + MFA satisfeito → `academy_admin`;
- Core `tenant_admin` + MFA satisfeito → `academy_admin`;
- `manager` → `academy_manager`;
- `technical` → `academy_technical`;
- `operator` → `academy_operator`;
- `finance` → `academy_finance`;
- `partner` → `academy_partner`.

Papel privilegiado sem MFA satisfeito **não recebe** papel administrativo da Academy.

Permissões Core também ficam disponíveis no `TrustedContext`, mas a v0.46 não inventa novos permission codes no Core. A autorização fina da Academy continuará sendo evoluída de forma compatível.

## Frontend

A Academy agora reutiliza o mesmo padrão do Core web:

- `@neondatabase/auth@0.5.0-beta`;
- `createAuthClient`;
- `BetterAuthReactAdapter`;
- `getSession().data.session.token`;
- `VITE_NEON_AUTH_URL`.

Foi criado `authenticatedFetch` para a migração gradual dos serviços internos. Endpoints públicos continuarão sem Bearer quando apropriado.

## Configuração de STAGE

Somente nomes de configuração; nenhum valor real deve ser versionado:

Frontend:

- `VITE_NEON_AUTH_URL`

Server/Pages Functions:

- `ACADEMY_CORE_API_URL`
- `ACADEMY_ADMIN_PROXY_SECRET` — temporariamente usado **somente** como secret interno middleware → endpoints Academy
- `ACADEMY_CORE_REQUEST_TIMEOUT_MS` — opcional, default 4000 ms, limitado de 500 a 10000 ms

O Core STAGE deve ser a origem do Bearer e do contexto. Não copiar secrets ou recursos de outros projetos.

## Fallback legado

Se `ACADEMY_CORE_API_URL` não estiver configurada, o boundary por headers/secret da v0.15 permanece disponível para DEV e testes existentes.

Esse fallback não é a arquitetura alvo e deve ser removido após a migração integral dos serviços frontend e homologação do Core em STAGE.

## Observabilidade

`GET /api/core-context` retorna apenas contexto não secreto do usuário autenticado:

- userId
- tenantId
- fonte da identidade
- papel Core
- papéis Academy projetados
- permissões Core
- estado MFA

O painel Operações mostra se está operando em `Core API v1` ou `Proxy legado`.

Token JWT, e-mail, secret interno e payloads de autenticação não são retornados por esse diagnóstico.

## Próxima etapa

v0.47 — Frontend Session & Authenticated API Migration:

- migrar todas as APIs protegidas do frontend para `authenticatedFetch`;
- preservar chamadas públicas sem Bearer;
- implementar shell de sessão Neon reutilizando o Core;
- integrar seleção de tenant através do endpoint do Core;
- renovar/carregar sessão conforme comportamento real do Core web;
- eliminar dependência do browser em headers legados.
