# CHANGELOG — v0.53.0

## Added
- `package-lock.json` íntegro, gerado pelo npm no GitHub Actions.

## Changed
- instalação do CI de `npm install` para `npm ci`;
- cache npm habilitado no setup do Node;
- metadados de pacote atualizados para `0.53.0`.

## Security
- workflow final permanece com `contents: read`;
- permissão temporária de bootstrap foi removida antes do merge;
- nenhum secret, token ou recurso externo foi adicionado.
