# RELEASE v0.61 — Tutor Learning Signals

## Objetivo
Transformar estado acadêmico verificável em próximos passos de estudo sem criar diagnóstico, score de capacidade ou perfil comercial do aluno.

## Sinais suportados
- ciclo concluído;
- aulas obrigatórias pendentes;
- avaliação pronta para iniciar;
- avaliação em andamento;
- correção manual pendente;
- revisão recomendada após tentativa não aprovada;
- avaliação aprovada com aulas obrigatórias ainda pendentes.

## Fonte dos dados
Somente dados autoritativos da Academy no tenant/ciclo do aluno: matrícula, `academy_learning_cycles`, `academy_course_lessons`, `academy_progress`, política de conclusão e `academy_quiz_attempts`.

## Garantias
- consulta read-only;
- nenhum provider externo;
- nenhum perfil persistente de dificuldade;
- nenhum uso comercial automático;
- nenhuma escrita de nota, progresso, tentativa, conclusão ou certificado;
- nenhuma linguagem de diagnóstico/condição pessoal no motor de sinais.

## Schema
Sem migration nova; permanecem 37 migrations.

## Deploy
Sem promoção automática para `main`/produção. Integração somente em `develop` após CI integralmente verde.
