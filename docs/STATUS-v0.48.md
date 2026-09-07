# STATUS — iFarm Academy v0.48

## Objetivo
Tornar explícita a autenticação HTTP no fluxo acadêmico principal, reduzindo a dependência do interceptor de compatibilidade criado na v0.47.

## Services migrados para `authenticatedJson`
- `courseBuilderApi.ts`;
- `coursePublicationApi.ts`;
- `enrollmentApi.ts`;
- `studentCourseApi.ts`;
- `studentAssessmentApi.ts`;
- `assessmentReviewApi.ts`;
- `quizPolicyApi.ts`.

## Fluxo protegido coberto
Curso → módulos/aulas → publicação → catálogo autenticado/matrícula → player → progresso → avaliação → tentativa → submissão → revisão manual → política de conclusão/certificação.

## Regras
- cada chamada protegida busca/usa o Bearer da sessão Neon Auth;
- ausência de token falha antes da chamada de rede;
- tenant continua derivado exclusivamente do iFarm Core;
- APIs públicas não foram convertidas para autenticação obrigatória;
- `workspaceApiTransport` permanece apenas como rede de compatibilidade para módulos ainda não migrados.

## Próximo bloco
v0.49: migrar Enterprise, Eventos, Marketplace, Instrutores, Relatórios, White Label administrativo, Notificações, Gamificação, Operações e Motor Comercial; depois remover o interceptor global do `/app` se nenhum fluxo protegido depender dele.
