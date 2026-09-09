# STATUS — iFarm Academy v0.61

## Escopo
Tutor Learning Signals: recomendações de estudo calculadas em tempo de consulta a partir do estado acadêmico objetivo do próprio aluno.

## Entregue
- endpoint autenticado `GET /api/tutor-signals?courseId=...`;
- motor puro de sinais acadêmicos;
- leitura somente do ciclo atual, progresso das aulas obrigatórias e tentativas da avaliação;
- recomendações para retomar aulas pendentes;
- sinal de avaliação pronta quando aulas obrigatórias estão concluídas;
- orientação para avaliação em andamento ou aguardando revisão manual;
- recomendação de revisão após tentativa não aprovada usando somente nota registrada e política publicada;
- sinal de ciclo concluído sem reabrir progresso;
- métricas factuais do ciclo atual;
- painel integrado ao Tutor com atualização manual;
- contrato explícito `diagnostic=false`, `commercialProfiling=false`, `persistsProfile=false` e `providerAttempted=false`;
- testes que rejeitam linguagem diagnóstica/score de capacidade no contrato;
- versão `0.61.0`.

## Privacidade e governança
- nenhum perfil permanente de dificuldade é criado;
- nenhum dado é enviado ao Motor Comercial;
- nenhum provider externo é chamado;
- nenhum diagnóstico médico, psicológico, cognitivo ou comportamental é produzido;
- nenhuma recomendação altera avaliação, progresso, conclusão ou certificado;
- tenant, aluno e ciclo são derivados do contexto Core e do banco autoritativo.

## Sem alteração de schema
A v0.61 é read-only e não adiciona migration. O total permanece em 37 migrations.

## Próximo bloco desbloqueado
Após v0.61, as próximas frentes funcionais exigem decisão/infraestrutura externa em maior grau: streaming homologado, Mercado Pago/comercial-fiscal, subscriptions/entitlements e marketplace financeiro. Antes de ativá-las, manter os contratos fail-closed existentes.
