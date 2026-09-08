# RELEASE — iFarm Academy v0.53.0

A v0.53 fecha uma dívida estrutural do CI: a Academy passa a possuir lockfile próprio e validado, e todas as instalações do pipeline passam a usar `npm ci`.

O lockfile foi gerado pelo npm no GitHub Actions a partir do `package.json` vigente, publicado temporariamente como artefato, conferido e somente depois versionado. A permissão de escrita usada no bootstrap foi removida antes do gate final.

## Gate de merge
- `npm ci`;
- TypeScript;
- testes unitários e contratos de Functions;
- migrations e todas as fixtures;
- contrato de STAGE readiness;
- build.

Nenhum deploy faz parte desta release.
