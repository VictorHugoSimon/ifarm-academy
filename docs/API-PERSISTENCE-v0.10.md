# iFarm Academy — API de persistência v0.10

Esta camada define o contrato entre o frontend e o futuro backend Cloudflare/D1. Não há credenciais, bindings reais nem deploy de produção.

## Progresso

`GET /api/progress?studentId=:studentId&courseId=:courseId`

Retorna a lista de progresso por aula.

`PUT /api/progress`

Upsert idempotente por `studentId + courseId + lessonId`. `progressPercent` deve permanecer entre 0 e 100.

## Tentativas

`GET /api/attempts?quizId=:quizId&studentId=:studentId`

Retorna tentativas ordenadas por `attemptNumber`.

`PUT /api/attempts/:id`

Persiste uma tentativa existente. O backend deverá rejeitar alteração de `studentId`, `quizId` e `attemptNumber` depois da criação e validar transições de status.

## Certificados

`GET /api/certificates?studentId=:studentId&courseId=:courseId`

Retorna certificados do aluno no curso.

`POST /api/certificates`

Emissão idempotente. Antes de persistir, o backend deverá recalcular a elegibilidade usando dados confiáveis de progresso e avaliação; nunca aceitar elegibilidade calculada somente pelo cliente.

## Segurança futura

Identidade de usuário/tenant deverá vir do iFarm Core. IDs enviados pelo browser não devem ser tratados como prova de identidade. O D1 da Academy deverá ser exclusivo do projeto. Secrets e bindings serão configurados somente no ambiente STAGE quando a infraestrutura estiver disponível.
