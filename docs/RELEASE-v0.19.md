# iFarm Academy v0.19

## Objetivo
Fechar o primeiro fluxo server-side de governança do curso até a matrícula do aluno.

## Entregas
- workflow de publicação `draft → review → published → archived`;
- readiness de publicação com validação de módulos, aulas obrigatórias e avaliação;
- papel de publicador restrito a administração;
- bloqueio de edição estrutural do Course Builder fora de `draft`;
- catálogo autenticado mostrando apenas cursos publicados do tenant;
- matrícula idempotente vinculada ao usuário e tenant autenticados;
- cancelamento e reativação de matrícula;
- snapshot de nome do aluno recebido do identity boundary confiável;
- auditoria de matrícula e transições de publicação;
- telas de Publicação e Catálogo/Matrículas integradas ao workspace;
- migration `0007_enrollments.sql`;
- máquina de estados de publicação coberta por testes;
- versão de aplicação `0.19.0`.

## Segurança
- `studentId`, `tenantId` e nome do aluno não vêm do body do navegador;
- matrícula só é permitida para curso `published` do mesmo tenant;
- publicação exige workflow e, na etapa final, role administrativa;
- nenhum secret real foi commitado;
- nenhum recurso de outro projeto foi utilizado.

## Não incluído
- deploy em STAGE;
- mudança em `main` ou produção;
- integração real com sessão do iFarm Core;
- Mercado Pago;
- definição de CNAE, regra fiscal ou comissão marketplace.

## Próxima versão
v0.20: Student Player + progresso por aula server-side + conclusão de matrícula.
