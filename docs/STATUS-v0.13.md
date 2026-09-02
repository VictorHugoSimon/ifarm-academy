# iFarm Academy — Status v0.13

## Entrega
Governança de avaliação ampliada com revisão manual auditável e versionamento administrativo da política de quiz, sem deploy e sem alteração de produção.

## Implementado
- revisão manual server-side para tentativas em `manual_review`;
- validação de que todas as questões pendentes foram revisadas;
- bloqueio de nota manual acima do máximo da questão;
- cálculo final combinando pontuação automática e manual;
- aprovação/reprovação final determinada no backend;
- auditoria por questão com revisor, nota, observação e data;
- snapshot da versão da política usada no envio da tentativa;
- histórico versionado das políticas publicadas;
- endpoint administrativo para publicar nova versão da política do quiz;
- backfill controlado da política publicada anterior no primeiro versionamento;
- testes formais da regra de correção manual;
- migration `0004_manual_review_policy_history.sql`;
- versão da aplicação atualizada para 0.13.0.

## Endpoints novos
- `POST /api/attempts/:id/review`
- `GET /api/quiz-policies?quizId=...`
- `POST /api/quiz-policies`

## Segurança e governança
- `main` e produção permanecem intactos;
- branch de trabalho: `feature/manual-review-v0.13`;
- nenhum secret ou binding real adicionado;
- nenhum recurso de outro projeto reutilizado;
- `reviewerId` e `actorId` são registrados para auditoria, mas a identidade autoritativa ainda deverá vir do iFarm Core quando a autenticação for integrada;
- CNAE, regras fiscais e comissão de marketplace continuam TBD;
- Layout Master preservado.

## CI
O workflow continua usando `npm install` porque ainda não existe `package-lock.json` válido no repositório. A troca para `npm ci` só deve ocorrer depois da geração e versionamento de lockfile íntegro; não foi feita alteração cosmética que quebraria o pipeline.

## Próxima prioridade
- autenticação/autoridade do iFarm Core nos endpoints administrativos e de revisão;
- testes de Functions com D1 isolado;
- lockfile íntegro e migração do CI para `npm ci`;
- interface administrativa para fila de correção manual;
- emissão de certificado após resultado final auditado.
