# Release v0.55.0 — Core User Directory

A v0.55 conecta a operação empresarial ao diretório real de memberships do iFarm Core.

## Resultado

O gestor deixa de digitar `userId` e nome como fonte de verdade. Em ambiente integrado, seleciona uma membership ativa do Core e a Academy valida novamente essa membership no servidor antes de gravar o colaborador.

A Academy persiste apenas a referência `core_membership_id`, `user_id`, snapshot de nome e metadados acadêmicos internos. O e-mail exibido no seletor não é copiado para o D1 Academy.

## Compatibilidade

O fluxo manual anterior continua somente para DEV/testes onde `ACADEMY_CORE_API_URL` não está configurada. Não existe fallback silencioso em ambiente integrado.

## Gate

Merge somente após `npm ci`, typecheck, testes, 34 migrations, fixtures existentes, fixture do Core Directory, readiness STAGE e build ficarem verdes.
