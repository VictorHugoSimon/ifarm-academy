# iFarm Academy — Status v0.18

## Entregas
- Quiz Builder conectado à API de políticas server-side versionadas;
- publicação deixa de ser simples toggle local e passa a criar versão autoritativa;
- versão server-side atual exibida na interface;
- listagem administrativa tenant-aware de cursos persistidos;
- seleção de curso vinculado pelo Quiz Builder quando o backend estiver disponível;
- fallback para courseId local em ambiente sem backend;
- publicação valida que o curso vinculado existe no mesmo tenant;
- após publicar a avaliação, a Academy calcula a quantidade de aulas obrigatórias do curso;
- política de conclusão é atualizada com `courseId`, `courseTitle`, `quizId`, nota mínima e quantidade de aulas obrigatórias;
- vínculo curso → avaliação passa a ser explícito;
- rascunho local continua disponível antes da publicação;
- versão 0.18.0.

## Fluxo de publicação
1. Professor/Admin edita a avaliação localmente.
2. Seleciona um curso persistido do mesmo tenant.
3. Academy carrega a estrutura autoritativa do curso.
4. Publica uma nova versão de `academy_quiz_policies`.
5. Salva snapshot da política no histórico.
6. Conta aulas obrigatórias do curso.
7. Atualiza `academy_course_completion_policy` vinculando o quiz ao curso.
8. Novas tentativas passam a usar a política publicada.

## Segurança
- curso só é listado dentro do tenant autenticado;
- publicação da política continua protegida por RBAC;
- vínculo de conclusão usa curso carregado do backend, não título enviado livremente pelo usuário;
- nenhuma credencial real é exposta no frontend.

## Decisão preservada
O exemplo local de NR-31 usa `C003`, enquanto o Course Builder inicial usa `C001`. A UI não força associação entre eles: o administrador seleciona explicitamente o curso correto quando este existir no backend.

## Próximos passos
- validar CI e merge em `develop`;
- persistir definição completa de quiz, incluindo textos/opções, não apenas política de correção;
- criar publicação de curso com estados draft/review/published;
- criar área administrativa de catálogo usando `academy_courses`;
- iniciar enrollment server-side integrado ao curso publicado.
