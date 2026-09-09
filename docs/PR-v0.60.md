# PR v0.60 — Tutor Learning Tools

## Escopo
Adicionar resumo, flashcards e exercícios de prática grounded ao AI Tutor usando exclusivamente fontes acadêmicas autorizadas.

## Gates esperados
- `npm ci`;
- typecheck;
- testes unitários/contratos;
- 37 migrations existentes;
- fixtures D1-compatible existentes;
- build.

## Invariantes
- nenhuma escrita em nota, tentativa, progresso, conclusão ou certificado;
- nenhuma chamada de provider externo pelos Learning Tools nesta release;
- sourceId deve pertencer ao conjunto de evidências recuperado;
- matrícula, curso publicado e autorização do Tutor são obrigatórios;
- nenhum secret ou credencial real foi adicionado.
