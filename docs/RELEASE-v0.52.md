# RELEASE — iFarm Academy v0.52.0

A v0.52 inaugura o Tutor IA com uma arquitetura segura e reversível. Nesta fase, o Tutor não chama nenhum modelo externo: ele pesquisa somente o conteúdo textual autorizado do curso em que o aluno está matriculado e retorna as fontes por módulo/aula.

Quando não existe evidência suficiente, o Tutor informa a limitação em vez de produzir uma resposta técnica presumida. O histórico fica segregado por tenant/usuário/curso e as mensagens são append-only.

## Gate
Merge somente com CI integralmente verde: typecheck, testes, **34 migrations**, todas as fixtures, fixture específica do Tutor e build.
