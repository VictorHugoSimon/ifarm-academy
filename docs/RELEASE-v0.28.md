# iFarm Academy v0.28 — Ciclos acadêmicos recorrentes auditáveis

## Objetivo
Permitir renovação real de treinamentos recorrentes sem reaproveitar progresso, tentativas, notas ou certificado de um ciclo anterior.

## Modelo
A unidade acadêmica deixa de ser apenas `Aluno + Curso` e passa a considerar `Aluno + Curso + Ciclo`.

Exemplo:

`Curso NR-31 → Ciclo 1 → conclusão → certificado 1 → renovação → Ciclo 2 → nova conclusão → certificado 2`

Cada ciclo possui identidade própria, número, origem, status, datas e vínculo opcional com o ciclo anterior.

## Banco de dados
Migration `0014_learning_cycles.sql`:
- cria `academy_learning_cycles`;
- adiciona `active_cycle_id` à matrícula;
- adiciona `learning_cycle_id` à atribuição corporativa;
- reconstrói progresso para chave `cycle_id + lesson_id`;
- reconstrói tentativas para escopo por ciclo;
- reconstrói certificados para permitir múltiplos certificados do mesmo curso, um por ciclo;
- faz backfill das matrículas existentes como ciclo 1;
- vincula progresso, tentativa, certificado e atribuição corporativa histórica ao ciclo 1;
- adiciona triggers de integridade para impedir mistura entre tenant, aluno, curso, aula, quiz e ciclo.

## Experiência do aluno
- Student Player carrega apenas progresso do ciclo atual.
- Registro de progresso exige ciclo ativo.
- Tentativas de avaliação são contadas por ciclo.
- O limite de tentativas reinicia em um novo ciclo.
- Submissão e revisão manual só podem atuar no ciclo ao qual a tentativa pertence.
- Conclusão considera apenas progresso e avaliação do ciclo atual.
- Certificado é emitido para o ciclo concluído e não substitui certificados anteriores.

## Área empresarial
- Atribuições de curso passam a apontar para `learning_cycle_id`.
- Trilhas empresariais leem progresso e conclusão do ciclo vinculado à atribuição.
- Conclusão acadêmica fecha a atribuição corporativa do mesmo ciclo.
- Quando todos os cursos obrigatórios de uma trilha são concluídos, a atribuição da trilha também é encerrada no banco.
- Monitor de renovação mostra ciclo acadêmico, ciclo de renovação e certificado anterior.
- A ação `Iniciar novo ciclo` só fica disponível quando a renovação está vencida ou na janela dos próximos 30 dias e não existe outro ciclo corporativo aberto.

## Materialização da renovação
Endpoint `POST /api/company-renewal-cycles`:
- recebe a atribuição concluída anterior;
- valida empresa, colaborador, curso, periodicidade e janela de renovação;
- exige ciclo anterior concluído e auditável;
- bloqueia duplicidade se já houver atribuição aberta;
- cria novo `academy_learning_cycles` ligado por `renewal_of_cycle_id`;
- reativa a matrícula apontando para o novo ciclo;
- cria nova atribuição corporativa ligada ao ciclo;
- não copia progresso, tentativas ou certificado.

## Compliance
A Academy não define automaticamente periodicidade de NR-31 ou de qualquer outra norma. `renewal_months` continua sendo uma regra configurada pela operação e deve refletir a exigência técnica/regulatória aplicável.

Nenhum certificado anterior é revogado pelo simples início de novo ciclo. Eventual regra de validade pública do certificado deve ser tratada como política própria, não inferida apenas pela periodicidade do treinamento.

## Testes e CI
- fixture principal atualizada para o modelo por ciclo;
- nova fixture `integration_learning_cycles_contract.py`;
- a fixture cria dados no modelo v0.27, aplica `0014`, valida o backfill e abre um segundo ciclo;
- prova isolamento de progresso entre ciclos;
- prova reinício da numeração de tentativas por ciclo;
- prova coexistência de certificados históricos do mesmo curso;
- prova bloqueio de escrita com ciclo/aluno incompatível;
- novo gate específico adicionado ao CI.

## Escopo de deploy
Nenhum deploy nesta release. Destino do PR: `develop`.

`main`, STAGE e produção não são alterados automaticamente.
