# STATUS — iFarm Academy v0.53

## Objetivo
Tornar a instalação do CI determinística com um `package-lock.json` íntegro e gerado pelo npm no próprio GitHub Actions.

## Concluído
- `package-lock.json` gerado pelo `npm install` do CI, não fabricado manualmente;
- artefato intermediário validado antes do versionamento;
- lockfile version 3;
- `package.json` e lockfile alinhados em `0.53.0` via `npm version --no-git-tag-version`;
- CI final usa `npm ci --no-audit --no-fund`;
- cache npm habilitado pelo `actions/setup-node`;
- permissão temporária `contents: write` removida;
- CI volta a `contents: read`;
- nenhum deploy adicionado.

## Segurança e integridade
O lockfile pertence exclusivamente ao repositório iFarm Academy e foi produzido a partir do `package.json` vigente. Nenhum lockfile de outro projeto foi reutilizado.

## Gate
A v0.53 só pode ser mergeada depois de um pipeline completo executando `npm ci`, typecheck, testes, migrations/fixtures, contrato STAGE e build.
