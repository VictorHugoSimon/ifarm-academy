# iFarm Academy v0.20

## Objetivo
Conectar a experiência do aluno aos dados reais do backend: matrícula, curso publicado, aulas, progresso, avaliação, conclusão e certificação.

## Entregas
- endpoint `/api/my-course` para entrega tenant-aware do curso matriculado;
- Player do aluno consumindo módulos e aulas do D1;
- progresso por aula server-side;
- posição de retomada (`last_position_seconds`);
- validação de que a aula pertence ao curso/tenant e de que existe matrícula válida;
- progresso monotônico: percentual concluído não regride;
- conclusão automática da matrícula quando aulas obrigatórias e avaliação forem atendidas;
- certificação disparada somente após requisitos reais de conclusão;
- correção do cálculo de certificado para considerar especificamente aulas obrigatórias;
- avaliação do aluno sem exposição do gabarito;
- tentativa, rascunho e submissão da prova usando endpoints server-side;
- snapshot publicado da avaliação ampliado com enunciado e opções sem alterar a autoridade do gabarito;
- fallback local preservado para DEV sem infraestrutura;
- migrations `0008_student_delivery.sql` e `0009_tenant_integrity.sql`;
- CI passa a validar todas as migrations sequencialmente em SQLite;
- versão `0.20.0`.

## Segurança
- aluno só acessa curso no qual está matriculado;
- tenant e identidade vêm do boundary confiável;
- endpoint estudantil de avaliação remove `correctOptionIds`;
- progresso rejeita aula de outro curso ou tenant;
- triggers de banco reforçam integridade tenant/curso/aula/quiz;
- nenhum secret real foi commitado;
- nenhum recurso de outro projeto foi utilizado.

## Governança
- destino: `develop`;
- `main` e produção permanecem intactos;
- sem deploy nesta versão.

## Próxima versão
v0.21: conteúdo real da aula (`content_json`), editor de conteúdo, materiais/anexos e preparação do streaming.
