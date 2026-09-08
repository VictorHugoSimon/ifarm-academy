# Homologação STAGE — iFarm Academy v0.52

## Objetivo
Homologar a Academy em infraestrutura exclusiva de STAGE antes de qualquer alteração em `main` ou produção.

## Critérios de entrada
- Cloudflare Pages exclusivo da Academy STAGE;
- D1 exclusivo com todas as migrations aplicadas;
- storage exclusivo quando `ACADEMY_STORAGE_REQUIRED=true`;
- `ACADEMY_CORE_API_URL` apontando para o iFarm Core homologado;
- `ACADEMY_ADMIN_PROXY_SECRET` configurado como secret server-side;
- `VITE_NEON_AUTH_URL` apontando para o mesmo Neon Auth usado pelo Core;
- `ACADEMY_ENVIRONMENT=stage`;
- `ACADEMY_RELEASE` igual à versão implantada.

## Critério fail-closed
Em `stage`, `staging`, `prod` ou `production`, `/api/readiness` só pode retornar HTTP 200 quando:
1. D1 responde;
2. boundary interno está configurado;
3. iFarm Core está configurado;
4. storage obrigatório, quando habilitado, está disponível.

O modo `legacy_proxy` é aceitável apenas em DEV/testes e não é homologável em STAGE.

## Smoke automatizado
Executar sem token para validar superfície pública:

```bash
ACADEMY_STAGE_URL=https://academy-stage.ifarm.agr.br \
ACADEMY_STAGE_EXPECTED_RELEASE=0.52.0 \
npm run stage:smoke
```

Executar com uma sessão de teste autorizada para validar identidade/tenant:

```bash
ACADEMY_STAGE_URL=https://academy-stage.ifarm.agr.br \
ACADEMY_STAGE_EXPECTED_RELEASE=0.52.0 \
ACADEMY_STAGE_BEARER_TOKEN='<fornecido somente no ambiente local/CI protegido>' \
npm run stage:smoke
```

O script não imprime o Bearer.

## Matriz mínima de homologação
| Cenário | Resultado esperado |
|---|---|
| `/api/health` | 200 e `service=ifarm-academy` |
| `/api/readiness` | 200, `status=ready`, `identityMode=core_api` |
| Portal `/` | 200 |
| Login Neon válido | `/app` abre com sessão Core |
| Usuário sem tenant ativo | seleção de tenant obrigatória |
| Troca de tenant | contexto recarregado e nenhum estado do tenant anterior permanece |
| `owner`/`tenant_admin` com MFA aplicável | navegação privilegiada somente com MFA satisfeito |
| operador comum | sem elevação administrativa |
| Bearer expirado | 401 e sessão local encerrada |
| `/api/core-context` autenticado | `identitySource=core_api` e tenant confirmado |
| tentativa de `x-ifarm-*` forjado | ignorada/substituída pelo contexto Core |
| tenant A tentando acessar dado do tenant B | bloqueado pelo backend |

## FAÇO SOZINHO
- manter smoke e contrato offline;
- validar migrations/fixtures/build no CI;
- corrigir regressões de código;
- manter `develop` como linha de integração;
- não executar deploy de produção.

## AÇÃO HUMANA
- autorizar/provisionar recursos Cloudflare exclusivos da Academy;
- cadastrar secrets no ambiente STAGE;
- disponibilizar usuário(s) de teste no iFarm Core/Neon Auth;
- confirmar domínio/DNS de STAGE quando aplicável;
- aceitar formalmente a homologação antes de promover para `main`/produção.

## Bloqueios posteriores
Mercado Pago, streaming real, canais externos de notificação e integração CRM continuam fora deste runbook até seus respectivos contratos/credenciais serem homologados.
