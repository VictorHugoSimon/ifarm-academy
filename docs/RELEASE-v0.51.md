# RELEASE — iFarm Academy v0.51.0

A v0.51 reforça a experiência da sessão integrada ao iFarm Core. Chamadas protegidas que recebem `401` passam a sinalizar expiração, e o workspace exige nova autenticação em vez de permanecer com estado visual inconsistente.

Também foi adicionada uma projeção conservadora de privilégio na navegação. O backend continua sendo a autoridade de autorização; a UI apenas deixa de exibir áreas claramente administrativas para perfis sem privilégio confirmado ou sem MFA satisfeito.

## Gate
Merge somente com CI integralmente verde.
