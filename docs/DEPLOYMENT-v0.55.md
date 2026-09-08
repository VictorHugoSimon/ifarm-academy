# iFarm Academy — Deployment v0.55

## Objetivo
Levar a Academy de `develop` até Cloudflare STAGE e PRODUCTION com recursos exclusivos do projeto, migrations versionadas, smoke test e integração real com o iFarm Core.

## Ambientes

| Ambiente | Branch | Pages | D1 | R2 | Core API | Neon Auth |
|---|---|---|---|---|---|---|
| STAGE | `stage` | `ifarm-academy-stage` | `ifarm-academy-stage` | `ifarm-academy-stage-materials` | `ifarm-core-api-stage...workers.dev` | Neon Auth STAGE do Core |
| PRODUCTION | `main` | `ifarm-academy` | `ifarm-academy-production` | `ifarm-academy-production-materials` | `ifarm-core-api...workers.dev` | Neon Auth PRODUCTION do Core |

Nenhum ID de D1/R2/Pages de outro projeto é aceito pelo provisionador. Os IDs são descobertos ou criados pela API Cloudflare usando os nomes exclusivos acima.

## GitHub Actions secrets obrigatórios
Cadastrar exclusivamente no repositório `VictorHugoSimon/ifarm-academy`:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

O token da Academy deve ser próprio deste projeto e limitado ao account iFarm, com permissões mínimas compatíveis com:
- Cloudflare Pages: Edit;
- D1: Edit/Write;
- Workers R2 Storage: Edit/Write.

Nunca copiar token de iFarm Core, Instituto Államo, Terra Pulse, SBS, Maison Decants, Ser Vital ou outro projeto.

## Secrets runtime
`ACADEMY_ADMIN_PROXY_SECRET` e `ACADEMY_COMMERCIAL_WORKER_SECRET` são gerados criptograficamente no runner a cada deploy e gravados diretamente como Pages secrets. Não ficam no GitHub nem no repositório.

## STAGE
1. PR da release deve estar verde em `develop`.
2. `stage` é atualizado para o SHA aprovado de `develop`.
3. O push dispara `Deploy iFarm Academy STAGE`.
4. O workflow valida credenciais, instala via lockfile, roda typecheck/testes/migrations offline e build.
5. O provisionador garante Pages + D1 + R2 exclusivos.
6. Todas as migrations pendentes são aplicadas no D1 remoto.
7. Secrets runtime são rotacionados.
8. Pages é publicado com bindings D1/R2 e vars de Core.
9. `scripts/smoke_stage.py` valida health, readiness e portal no `pages.dev`.
10. A homologação autenticada com Bearer valida sessão/tenant/MFA quando houver usuário de STAGE autorizado.

Endpoint de validação inicial:
`https://ifarm-academy-stage.pages.dev`

Domínio desejado (anexação best-effort pelo pipeline):
`https://academy-stage.ifarm.agr.br`

## Promoção para PRODUCTION
Somente depois de STAGE verde:
1. abrir PR `develop -> main`;
2. CI de promoção precisa ficar verde;
3. merge em `main` dispara `Deploy iFarm Academy PRODUCTION`;
4. workflow repete validações e provisiona somente recursos `ifarm-academy*` de produção;
5. migrations são aplicadas antes do deploy;
6. Pages é publicado;
7. smoke obrigatório roda em `https://ifarm-academy.pages.dev`;
8. domínio `academy.ifarm.agr.br` é solicitado em best-effort e não mascara falha de DNS.

## Rollback
- Código: redeploy de SHA anterior conhecido e aprovado.
- D1: migrations nunca são apagadas automaticamente; rollback de schema exige migration compensatória. Cloudflare mantém backup por execução de migration.
- R2: objetos não são apagados pelo deploy.
- Pages: histórico de deployments permanece disponível na Cloudflare.

## Gates que bloqueiam produção
- CI vermelho;
- secrets Cloudflare ausentes;
- D1/R2/Pages fora do namespace `ifarm-academy`;
- migration remota com falha;
- readiness sem `identityMode=core_api`;
- D1/identity/storage não prontos;
- smoke pós-deploy vermelho.

## Fora do deploy base
- credenciais Mercado Pago;
- integração CRM externa;
- provedor de streaming dedicado;
- token de usuário para smoke autenticado;
- decisões fiscais/comerciais TBD.

Esses itens não autorizam simulação de pagamento/CRM nem reutilização de credenciais de outro projeto.
