# Release v0.54.0 — Core Permission Capabilities

A v0.54 refina a integração Academy ↔ iFarm Core para aplicar menor privilégio na Área Empresarial.

## Regra principal

O nome do papel Core não é suficiente para elevar acesso. A capacidade empresarial é projetada somente quando o Core confirmou as permissions `organization.manage`, `user.manage` e `notification.manage`, com MFA satisfeito.

## Resultado

- gestores qualificados operam empresas, colaboradores, atribuições e trilhas no tenant ativo;
- não recebem `academy_admin`;
- não podem criar novas empresas Academy;
- administradores globais preservam o fluxo atual;
- usuários comuns não veem os módulos empresariais no workspace;
- a segurança do backend permanece independente da visibilidade da UI.

## Core notifications

A inspeção read-only confirmou capabilities RBAC de notificações no Core, mas não encontrou serviço, rota ou outbox de entrega implementada. A Academy não cria integração fictícia até existir esse contrato.

## Gate

Merge somente após `npm ci`, typecheck, testes, migrations/fixtures, STAGE readiness contract e build ficarem verdes.
