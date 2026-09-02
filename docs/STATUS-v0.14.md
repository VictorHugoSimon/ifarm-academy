# iFarm Academy — Status v0.14

## Entrega
Fila administrativa de correção manual conectada ao backend, preservando fallback local para desenvolvimento sem infraestrutura.

## Implementado
- endpoint `GET /api/reviews` para listar tentativas em `manual_review`;
- resolução da política versionada correspondente à tentativa;
- retorno de respostas, questões pendentes, nota mínima e versão da política;
- adapter HTTP `assessmentReviewApi` no frontend;
- interface de revisão conectada ao endpoint server-side;
- lançamento de nota por questão aberta;
- envio de revisor, observações e pontuação ao backend;
- exibição do resultado final devolvido pelo servidor;
- fallback automático para o modo local quando a API não está disponível;
- versão atualizada para 0.14.0.

## Decisão de arquitetura
A UI não calcula a nota final autoritativa. Em modo servidor, ela apenas coleta a avaliação manual e envia para `POST /api/attempts/:id/review`; o backend decide o resultado final.

## Segurança e governança
- `main` e produção não alterados;
- branch: `feature/review-queue-v0.14`;
- nenhum deploy;
- nenhum secret/binding real;
- nenhum recurso de outros projetos;
- identidade definitiva do revisor ainda depende do iFarm Core;
- CNAE, regras fiscais e comissão marketplace permanecem TBD;
- Layout Master preservado.

## Próxima prioridade
- RBAC/identidade do iFarm Core para revisão e administração;
- fila com filtros por curso, quiz, empresa e tempo de espera;
- emissão de certificado imediatamente após elegibilidade validada;
- testes de Functions com D1 isolado;
- provisionamento de STAGE quando a infraestrutura estiver autorizada.
