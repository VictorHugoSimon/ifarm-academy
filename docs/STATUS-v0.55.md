# STATUS — iFarm Academy v0.55

## Escopo
Pipeline controlado de promoção `develop -> stage -> main -> production` para Cloudflare Pages + D1 + R2.

## Entregue
- workflow STAGE em push da branch `stage`;
- workflow PRODUCTION em push da branch `main`;
- CI também valida PRs/pushes para `main`;
- provisionador Cloudflare sem IDs hardcoded de recursos;
- namespace exclusivo `ifarm-academy*` obrigatório;
- criação/reuso seguro de Pages, D1 e R2 da própria Academy;
- aplicação remota de migrations versionadas antes do deploy;
- secrets internos gerados e rotacionados no runner;
- integração STAGE/PRODUCTION com as URLs oficiais do iFarm Core e Neon Auth de cada ambiente;
- `ACADEMY_STORAGE_REQUIRED=true` em runtime publicado;
- smoke pós-deploy obrigatório em `pages.dev`;
- anexação best-effort de `academy-stage.ifarm.agr.br` e `academy.ifarm.agr.br`;
- contrato offline de isolamento/deployment no CI;
- documentação de rollback e requisitos de credenciais.

## Segurança
- nenhum token/secret versionado;
- nenhum resource ID de outro projeto aceito como argumento;
- nenhuma credencial do iFarm Core reutilizada;
- D1 e R2 de STAGE/PRODUCTION possuem nomes diferentes;
- produção só é disparada por `main` ou dispatch explícito;
- migrations falhas bloqueiam deploy;
- smoke vermelho bloqueia conclusão do workflow.

## Release runtime
O campo `ACADEMY_RELEASE` usa os 12 primeiros caracteres do Git SHA efetivamente publicado. Isso evita divergência entre package metadata e deployment real.

## Gate externo restante
Para o primeiro deploy real, o repositório `ifarm-academy` precisa ter seus próprios GitHub Actions secrets:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Se ausentes, o workflow encerra antes de provisionar qualquer recurso e informa exatamente qual secret falta.
