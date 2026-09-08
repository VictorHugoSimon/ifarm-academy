# Status v0.54 — Core Permission Capabilities & Enterprise Least Privilege

## Objetivo

Substituir inferência ampla por nome de papel por uma capacidade empresarial derivada das permissões verificadas do iFarm Core, sem promover gestores empresariais a administradores globais da Academy.

## Entregas

- capability `academy_enterprise_manager` derivada de `organization.manage` + `user.manage` + `notification.manage` e MFA satisfeito;
- `manager` sem as capabilities exigidas não recebe acesso empresarial;
- `technical`, `operator`, `finance` e `partner` permanecem fora dessa capacidade por padrão;
- owner/tenant_admin continuam `academy_admin` somente com MFA satisfeito;
- enterprise manager pode operar empresas existentes dentro do tenant ativo, mas não criar novas empresas Academy;
- bootstrap `/api/core-session` passa a carregar permissions verificadas;
- navegação mostra Área Empresarial/Trilhas Empresariais somente para Academy admin ou enterprise manager;
- backend continua como autoridade final;
- comportamento legado `company_admin` permanece somente como compatibilidade temporária de DEV com scope explícito;
- descoberta documentada: Core possui permissions de notificação, mas não possui serviço/outbox de notificações implementado no código atual inspecionado.

## Segurança

Nenhum tenant, papel ou permission é aceito como autoridade a partir do browser. O contexto continua vindo do Bearer Neon validado no iFarm Core e é projetado internamente pelo middleware da Academy.

## Fora do escopo

- nenhuma alteração no iFarm Core;
- nenhum adapter fictício de notificações;
- nenhum deploy STAGE/PRODUCTION;
- nenhuma mudança em `main`;
- nenhuma credencial real.
