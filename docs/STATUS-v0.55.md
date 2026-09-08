# Status v0.55 — Core User Directory & Enterprise Membership Alignment

## Objetivo

Eliminar identidade empresarial arbitrária quando a Academy está integrada ao iFarm Core. Novos colaboradores passam a ser vinculados a uma membership ativa do tenant atual no Core.

## Entregas

- adapter server-side para `GET /api/v1/memberships` do iFarm Core;
- endpoint Academy `/api/core-memberships` protegido pelo contexto empresarial;
- filtro obrigatório por tenant ativo e `status=active`;
- referência `core_membership_id` persistida em `academy_company_members`;
- nome do colaborador vira snapshot da identidade Core;
- e-mail é usado somente para seleção na UI e não é persistido no D1 Academy;
- POST de colaborador exige `membershipId` quando `ACADEMY_CORE_API_URL` está configurada;
- input manual `userId/displayName` permanece somente como fallback explícito de DEV/testes sem Core;
- seletor de memberships ativas na Área Empresarial;
- migration `0034_core_membership_reference.sql`;
- testes de adapter e fixture SQLite dedicada.

## Segurança

A Academy não confia em `userId`, nome, role, tenant ou membership fornecidos pelo browser em ambiente integrado. A membership é resolvida novamente no Core usando o Bearer da sessão atual.

## Descoberta complementar

Durante esta versão, o Core atual foi reinspecionado e confirmou que `/notifications` e `/memberships` já estão implementados em `operations-routes.ts` e `user-management-routes.ts`. Isso atualiza a descoberta histórica registrada na v0.54 e abre a próxima integração de notificações sem necessidade de inventar barramento.

## Fora do escopo

- nenhuma alteração no iFarm Core;
- nenhum convite/membership criado pela Academy;
- nenhum e-mail duplicado no banco Academy;
- sem deploy, sem secrets e sem mudança em `main`.
