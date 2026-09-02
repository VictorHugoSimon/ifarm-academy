# Matriz de testes — v0.13

| Cenário | Resultado esperado |
|---|---|
| Avaliação 100% automática acima da mínima | `approved` |
| Avaliação 100% automática abaixo da mínima | `failed` |
| Questão aberta presente | `manual_review` |
| Revisão manual completa com nota final >= mínima | `approved` |
| Revisão manual completa com nota final < mínima | `failed` |
| Revisão manual sem corrigir todas as questões | HTTP 400 |
| Nota manual maior que pontuação máxima | HTTP 400 |
| Revisão de questão que não está pendente | HTTP 400 |
| Revisão de tentativa fora de `manual_review` | HTTP 409 |
| Publicação de política válida | cria nova versão |
| Publicação com IDs duplicados de questão | HTTP 400 |
| Publicação com nota mínima fora de 0..100 | HTTP 400 |
| Tentativa submetida | registra `policy_version` |
| Certificado público | permanece validável sem expor gabarito |

O CI atual cobre typecheck, testes Vitest e build. Testes de integração com D1 isolado permanecem na próxima camada.
