# STATUS — iFarm Academy v0.52

## Objetivo
Entregar a fundação segura do Tutor IA sem depender de provedor externo e sem permitir respostas técnicas não ancoradas no conteúdo autorizado.

## Concluído
- migration `0034_tutor_foundation.sql`;
- sessões tenant/user/course-aware;
- mensagens append-only com snapshot de citações;
- retrieval determinístico por conteúdo textual autorizado;
- normalização de acentos/termos e ranking de evidências;
- endpoint autenticado `/api/tutor`;
- matrícula ativa/concluída obrigatória;
- resposta fail-safe quando não existe evidência suficiente;
- histórico por conversa;
- UI `Tutor IA` no workspace do aluno;
- modo `evidence_only` explicitamente exibido;
- testes unitários do retrieval;
- fixture D1 de isolamento/imutabilidade;
- gate específico no CI.

## Não implementado de propósito
- LLM/provedor externo;
- embeddings/vector database;
- busca web;
- geração de resposta sem evidência;
- envio de conteúdo do aluno a terceiros.

## Próximo passo
A próxima evolução pode incluir flashcards/resumos/exercícios determinísticos sobre evidências autorizadas ou um adapter LLM server-side, mas qualquer provedor continua TBD e deverá respeitar o boundary documentado.
