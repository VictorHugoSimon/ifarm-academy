# Notas técnicas

- A migration 0004 adiciona `policy_version` às tentativas e cria as tabelas de auditoria/histórico.
- A primeira publicação posterior à v0.12 faz backfill da política publicada anterior para preservar rastreabilidade.
- O CI permanece sem deploy.
- A troca para `npm ci` foi deliberadamente adiada por ausência de lockfile válido.
