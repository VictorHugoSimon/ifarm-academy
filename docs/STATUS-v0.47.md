# STATUS — iFarm Academy v0.47

## Objetivo
Fechar a passagem do frontend protegido para a identidade central do iFarm Core, sem login, tenant ou RBAC paralelo.

## Entregas
- `/app` protegido pela sessão Neon Auth já usada pelo iFarm Core;
- login da Academy reutilizando `signIn.email` do Core, sem tabela de usuário própria;
- transporte autenticado instalado somente no workspace `/app`, adicionando Bearer às chamadas same-origin `/api/*` existentes;
- transporte falha fechado quando a sessão não possui token;
- portal público, planos, descoberta pública, validação de certificado e check-in público não recebem o interceptor do workspace;
- endpoint `/api/core-session` para bootstrap de identidade e lista de memberships antes de existir tenant ativo;
- troca de tenant somente por `POST /api/v1/me/active-tenant` do iFarm Core;
- headers `x-ifarm-*` do browser continuam removidos inclusive no bootstrap;
- reload obrigatório após troca de tenant para limpar estado de tela do tenant anterior;
- barra de sessão mostra empresa ativa, identidade, papel e logout;
- aviso de MFA quando exigido pelo Core;
- configuração de DEV/STAGE alinhada a `VITE_NEON_AUTH_URL`, `ACADEMY_CORE_API_URL` e `ACADEMY_ADMIN_PROXY_SECRET`;
- testes do bootstrap e do escopo do transporte autenticado.

## Segurança
- JWT Neon permanece no mecanismo de sessão do Core;
- a Academy não persiste token em storage próprio;
- tenant não é aceito como autoridade a partir do browser;
- mudança de tenant é validada pelo Core contra membership ativa;
- endpoints protegidos continuam recebendo contexto interno somente após o middleware validar o Bearer no Core;
- nenhum secret foi adicionado ao repositório.

## Compatibilidade
O boundary legado sem `ACADEMY_CORE_API_URL` continua disponível apenas para DEV/testes antigos. Quando o Core está configurado, o caminho esperado é sessão Neon + Core API.

## Próximo bloco
v0.48: remover `fetch` cru dos services protegidos gradualmente, centralizar contratos HTTP, adicionar política de sessão expirada/401 e reforçar testes de isolamento do frontend por tenant.
