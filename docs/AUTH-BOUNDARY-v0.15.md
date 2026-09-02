# Boundary de identidade administrativa — v0.15

## Objetivo
Proteger endpoints administrativos antes da integração definitiva com o iFarm Core, sem criar um sistema de login paralelo.

## Estratégia
As Pages Functions administrativas operam em modo **fail-closed**.

Para aceitar uma requisição, o ambiente precisa possuir o secret:

`ACADEMY_ADMIN_PROXY_SECRET`

E a requisição precisa chegar de uma camada confiável contendo:

- `x-ifarm-proxy-secret`
- `x-ifarm-user-id`
- `x-ifarm-roles`
- `x-ifarm-tenant-id` quando aplicável

## Papéis reconhecidos nesta camada
- `academy_admin`
- `academy_reviewer`
- `ifarm_admin`

Cada endpoint define os papéis permitidos.

## Importante
O navegador **não deve receber nem armazenar** `ACADEMY_ADMIN_PROXY_SECRET`.

A intenção é que, no estágio definitivo, uma camada de autenticação confiável do iFarm Core valide a sessão e injete a identidade no tráfego interno. Esta implementação é uma fronteira reversível, não uma substituição do SSO/RBAC da iFarm.

## Fail-closed
Se o secret não estiver configurado, endpoints administrativos retornam 503.
Se o segredo recebido não conferir, retornam 401.
Se o usuário não possuir papel permitido, retornam 403.

## Endpoints protegidos nesta versão
- `GET /api/reviews`
- `POST /api/attempts/:id/review`
- `GET /api/quiz-policies`
- `POST /api/quiz-policies`

## Antes de STAGE público
- definir o contrato real de autenticação do iFarm Core;
- substituir/adaptar a fronteira de proxy pelo middleware oficial;
- armazenar secrets somente em Cloudflare Secrets;
- configurar auditoria e rate limiting;
- testar isolamento por tenant.
