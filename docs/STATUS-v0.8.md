# iFarm Academy — Status v0.8

## Entrega desta versão

A v0.8 conecta a cadeia acadêmica principal do MVP: criação do curso → avaliação → experiência do aluno → revisão manual → elegibilidade → emissão de certificado.

## Fluxo integrado
- `AcademyWorkspacePage` reúne Course Builder, Quiz Builder, Player do aluno, Revisão e Certificação;
- Student Player v0.8 executa avaliação real dentro da aula de quiz;
- respostas ficam persistidas durante a tentativa;
- tentativa respeita publicação e limite configurado;
- envio usa o motor de correção automática da v0.7;
- respostas abertas direcionam a tentativa para `manual_review`;
- revisão manual consolida pontos automáticos + pontos manuais;
- nota final define `approved` ou `failed`;
- certificado só fica elegível quando progresso e avaliação obrigatória são atendidos;
- emissão é idempotente por aluno + curso no repositório local;
- certificado recebe código público iFarm Academy.

## Regras implementadas
1. avaliação não publicada não inicia;
2. limite de tentativas é respeitado;
3. resposta aberta não permite aprovação automática;
4. revisão manual limita pontos ao máximo configurado;
5. nota final considera parte automática e manual;
6. curso incompleto bloqueia certificado;
7. avaliação pendente/reprovada bloqueia certificado;
8. tentativa aprovada + curso concluído libera emissão;
9. certificado válido existente é reutilizado, evitando duplicidade.

## Verificação de regras
Foi criado `runAssessmentRuleChecks()` com seis verificações determinísticas cobrindo:
- encaminhamento para revisão manual;
- nota automática;
- aprovação após revisão;
- nota final;
- bloqueio por progresso incompleto;
- liberação de certificado.

## Git
- PR v0.7 foi mergeado com squash em `develop` antes desta evolução;
- desenvolvimento v0.8 realizado em `feature/assessment-cert-v0.8`;
- `main` e produção não foram alterados.

## Segurança e decisões preservadas
- nenhum secret adicionado;
- nenhum banco, token ou recurso de outro projeto utilizado;
- persistência desta fase continua local para validação do fluxo;
- autenticação real permanece dependente do iFarm Core;
- CNAE continua TBD;
- regras fiscais continuam TBD;
- percentual de comissão do marketplace continua TBD.

## Próxima prioridade
1. bootstrap executável do front-end completo no repositório (package/entrypoint/shell do Layout Master);
2. migrar persistência de tentativas/certificados para API + D1;
3. CRUD completo de módulos/aulas e avaliações via API;
4. validação pública de certificado com rota própria;
5. testes automatizados em runner formal;
6. preparar deploy STAGE quando Cloudflare estiver acessível.
