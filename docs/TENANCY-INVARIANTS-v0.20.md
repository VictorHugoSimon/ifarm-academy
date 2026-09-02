# Invariantes multi-tenant — v0.20

## Regra de identidade
A Academy não cria identidade paralela. `userId`, `tenantId`, roles e nome autenticado devem chegar pelo boundary confiável do iFarm Core.

## IDs
IDs de recursos acadêmicos (`courseId`, `moduleId`, `lessonId`, `quizId`, `attemptId`, `certificateId`) são tratados como identificadores globalmente únicos.

## Isolamento obrigatório
Mesmo com IDs globais, toda leitura e escrita de domínio deve filtrar `tenant_id`. O ID isolado nunca é autorização suficiente.

## Banco
A migration `0009_tenant_integrity.sql` adiciona triggers para impedir gravações incoerentes entre:
- progresso e aula/curso/tenant;
- tentativa e quiz/tenant;
- matrícula e curso/tenant;
- certificado e política de conclusão/tenant.

## Aplicação
- Course Builder: tenant obrigatório.
- Publicação: tenant + RBAC.
- Catálogo: somente `published` do tenant.
- Matrícula: usuário e tenant autenticados.
- Player: exige matrícula válida.
- Progresso: valida curso e aula antes de gravar.
- Avaliação: exige matrícula e não entrega gabarito.
- Certificado: exige política, progresso obrigatório e avaliação quando aplicável.

## STAGE
Como o D1 real ainda não foi provisionado, a primeira criação de STAGE deverá aplicar as migrations 0001→0009 em ordem e executar o validador antes do smoke test.
