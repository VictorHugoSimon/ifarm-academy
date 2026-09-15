# STATUS — iFarm Academy v0.60

## Escopo
Ferramentas de estudo grounded do AI Tutor: resumo, flashcards e exercícios de prática derivados exclusivamente das fontes acadêmicas já autorizadas e indexadas.

## Entregue
- endpoint autenticado `POST /api/tutor-tools`;
- ferramentas `summary`, `flashcards` e `practice_exercises`;
- matrícula ativa ou concluída obrigatória;
- curso publicado e Tutor explicitamente autorizado obrigatórios;
- seleção de evidências usando o índice acadêmico já governado;
- foco opcional informado pelo aluno, limitado a 300 caracteres;
- contrato tipado de saída por ferramenta;
- validação server-side de todos os `sourceId` contra o conjunto recuperado;
- falha fechada quando não existe evidência suficiente ou quando o contrato é inválido;
- citações com aula, tipo da fonte e trecho de evidência;
- painel no Tutor para gerar materiais e navegar pelas referências;
- referência dos exercícios revelada sob demanda;
- indicação explícita de que exercícios não são avaliação oficial;
- testes de groundedness, limites, ausência de fontes forjadas e ausência de campos acadêmicos de nota/tentativa;
- versão `0.60.0`.

## Decisão de arquitetura
Na v0.60, Learning Tools operam somente em `evidence_only`. O provider generativo externo não é chamado por essas ferramentas. Isso mantém o primeiro contrato simples, auditável e totalmente derivado das fontes aprovadas; eventual geração externa estruturada poderá ser adicionada depois sob as mesmas políticas de versão, quota, consentimento e guardrails do Tutor principal.

## Segurança acadêmica
- nenhuma ferramenta escreve em `academy_progress`, tentativas de quiz, notas, conclusão ou certificados;
- nenhuma ferramenta cria aprovação/reprovação;
- `sourceId` ausente ou fora do conjunto recuperado invalida o artefato;
- material insuficiente retorna erro em vez de completar conhecimento ausente;
- admin sem matrícula não recebe material de estudo como se fosse aluno;
- tenant e aluno continuam derivados da identidade Core confiável.

## Sem alteração de schema
A v0.60 reutiliza o índice e a governança do Tutor existentes. Não adiciona migration; o total permanece em 37 migrations.

## Próximo bloco sugerido
v0.61 — Tutor Learning Signals: recomendações de estudo e sinais de dificuldade baseados apenas em comportamento acadêmico permitido, sem diagnóstico indevido e sem perfilamento comercial automático.
