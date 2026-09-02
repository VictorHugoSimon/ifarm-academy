# iFarm Academy — Status v0.17

## Entregas
- schema D1 para `academy_courses`, `academy_course_modules` e `academy_course_lessons`;
- isolamento por tenant em todo o Course Builder;
- endpoint `GET /api/course-builder?courseId=...`;
- endpoint `PUT /api/course-builder` para salvar snapshot completo do curso;
- bloqueio contra reaproveitamento de `courseId` pertencente a outro tenant;
- validação de módulos, aulas, tipos de conteúdo, duração e configuração estrutural da avaliação;
- gravação auditável de cada salvamento do Course Builder;
- adapter frontend para carregar e salvar via API;
- fallback local preservado quando backend/identity boundary ainda não estiver disponível;
- hidratação automática da tela pelo backend quando conectado;
- rascunho local contínuo entre salvamentos;
- status visual de persistência server-side/local;
- migration `0006_course_builder.sql`;
- versão 0.17.0.

## Modelo de persistência
`CourseBuilderState` continua sendo o contrato da tela:

Course
- id
- tenant
- título
- status
- configuração estrutural de avaliação

Module
- id
- courseId
- título
- descrição
- posição

Lesson
- id
- moduleId
- courseId
- título
- contentType
- duração
- obrigatória
- posição

## Decisão de arquitetura
O Quiz Builder demonstrativo atual usa um curso diferente do Course Builder. Por isso a v0.17 não cria um `quizId` artificial. A associação curso-avaliação será feita explicitamente quando a avaliação for publicada para o mesmo curso.

## Segurança
- `courseId` não pode migrar entre tenants;
- leitura e gravação exigem contexto confiável iFarm;
- papéis permitidos: Academy Admin, Academy Instructor/Instructor e iFarm Admin;
- nenhum secret real no frontend;
- nenhum recurso de outro projeto reutilizado.

## Próximos passos
- validar CI e merge em `develop`;
- conectar Quiz Builder à API de política versionada;
- associar quiz ao curso de forma explícita;
- sincronizar política de conclusão a partir do curso publicado;
- evoluir conteúdo de aula além dos metadados.
