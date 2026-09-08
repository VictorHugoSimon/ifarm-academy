# RELEASE — v0.55 Cloudflare Deployment Pipeline

A v0.55 transforma a iFarm Academy de uma aplicação pronta para STAGE em uma aplicação promovível até produção por GitHub Actions, mantendo isolamento de recursos e gates obrigatórios.

## Fluxo
`feature -> develop -> stage -> Cloudflare STAGE -> smoke -> PR develop/main -> main -> Cloudflare PRODUCTION -> smoke`

## Recursos STAGE
- Pages: `ifarm-academy-stage`
- D1: `ifarm-academy-stage`
- R2: `ifarm-academy-stage-materials`
- Core: API e Neon Auth oficiais de STAGE

## Recursos PRODUCTION
- Pages: `ifarm-academy`
- D1: `ifarm-academy-production`
- R2: `ifarm-academy-production-materials`
- Core: API e Neon Auth oficiais de PRODUCTION

## Critério de aceite
1. CI da PR v0.55 verde.
2. Merge em `develop`.
3. Atualização controlada da branch `stage`.
4. Deploy STAGE verde e smoke aprovado.
5. PR de promoção para `main` verde.
6. Merge em `main`.
7. Deploy PRODUCTION verde e smoke aprovado.

A ausência dos secrets Cloudflare exclusivos da Academy é um bloqueio explícito de infraestrutura, não um motivo para reutilizar credenciais de outro projeto.
