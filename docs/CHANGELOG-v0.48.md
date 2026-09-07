# CHANGELOG — v0.48.0

## Changed
- Course Builder e publicação agora usam transporte autenticado explícito.
- Catálogo autenticado e matrículas agora usam transporte autenticado explícito.
- Player do aluno, progresso e avaliação server-side agora usam transporte autenticado explícito.
- Fila/revisão manual e publicação de políticas de quiz agora usam transporte autenticado explícito.
- versão do pacote atualizada para `0.48.0`.

## Security
- chamadas do núcleo acadêmico protegido não dependem mais de `fetch` cru para receber Bearer;
- falha de sessão ocorre antes da rede por `authenticatedJson`/`authenticatedFetch`;
- serviços públicos permanecem separados do transporte autenticado obrigatório.
