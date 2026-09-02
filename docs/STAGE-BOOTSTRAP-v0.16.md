# STAGE Bootstrap — iFarm Academy v0.16

## Objetivo
Preparar o ambiente de homologação sem tocar produção e sem reutilizar recursos de outros projetos.

## Recursos exclusivos esperados
- Cloudflare Pages: `ifarm-academy-stage`
- D1: `ifarm-academy-stage`
- Domínio alvo: `academy-stage.ifarm.agr.br`
- Binding D1: `ACADEMY_DB`
- Secret server-side: `ACADEMY_ADMIN_PROXY_SECRET`

## Ordem de provisionamento
1. Criar projeto Cloudflare Pages exclusivo da Academy STAGE.
2. Criar D1 exclusivo `ifarm-academy-stage`.
3. Aplicar migrations em ordem: `0001` até `0005`.
4. Configurar binding `ACADEMY_DB` somente no projeto Academy STAGE.
5. Cadastrar `ACADEMY_ADMIN_PROXY_SECRET` como secret server-side.
6. Configurar a futura camada confiável do iFarm para injetar:
   - `x-ifarm-proxy-secret`
   - `x-ifarm-user-id`
   - `x-ifarm-user-name`
   - `x-ifarm-tenant-id`
   - `x-ifarm-roles`
7. Publicar a branch `develop` em STAGE somente após CI verde.
8. Executar smoke tests de saúde, progresso, tentativa, revisão, certificado e segregação de tenant.
9. Somente depois configurar `academy-stage.ifarm.agr.br`.

## Critérios de aceite do STAGE
- nenhum recurso de produção alterado;
- D1 exclusivo da Academy;
- migrations aplicadas sem erro;
- endpoints sem identity boundary retornam fail-closed;
- tenant A não acessa registros do tenant B;
- avaliação automática e manual persistem resultado server-side;
- certificado só é emitido com política, progresso e avaliação elegíveis;
- validação pública funciona por código único;
- logs de auditoria registram publicação, submissão, revisão e emissão;
- rollback do deploy disponível.

## Bloqueios humanos
O provisionamento real depende de acesso/autorização Cloudflare e da definição do contrato de identidade do iFarm Core. Este documento não contém tokens, IDs de banco ou secrets reais.
