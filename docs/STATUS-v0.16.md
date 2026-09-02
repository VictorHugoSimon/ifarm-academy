# iFarm Academy — Status v0.16

## Entregas
- isolamento por tenant aplicado a progresso, tentativas, políticas, revisão e certificados;
- contexto confiável exige `userId` e `tenantId`;
- identidade do aluno/revisor deixa de depender de campos livres do browser;
- tentativa armazena snapshot de nome confiável para certificação;
- endpoint legado de tentativa limitado a salvar rascunho de respostas;
- política de conclusão administrável por tenant;
- metadados do curso para certificado passam a vir da política autoritativa;
- emissão automática de certificado após aprovação quando todos os critérios forem atendidos;
- emissão manual idempotente e tenant-aware;
- filtros server-side na fila de correção;
- tela de revisão atualizada para não solicitar identidade do revisor;
- trilha de auditoria administrativa criada;
- endpoint de consulta de auditoria por tenant;
- migration `0005_tenant_audit_certificate.sql`;
- template seguro de Cloudflare STAGE;
- documentação de bootstrap STAGE;
- versão 0.16.0.

## Segurança
- tenant é obrigatório no boundary confiável;
- queries operacionais filtram `tenant_id`;
- estudante só lê/grava o próprio progresso e tentativa autenticados;
- revisão manual só acessa tentativa do tenant autenticado;
- publicação de política fica auditada;
- certificado não aceita mais nome do aluno ou título do curso como autoridade do navegador;
- nenhum secret real foi commitado.

## Emissão de certificado
O backend tenta emitir automaticamente após:
1. aprovação automática ou revisão manual;
2. localização de política de conclusão no mesmo tenant;
3. progresso obrigatório completo;
4. avaliação obrigatória aprovada e nota mínima atingida;
5. existência de nome confiável do aluno e título autoritativo do curso.

Se algum requisito não estiver pronto, a tentativa permanece aprovada, mas o certificado não é forçado. O retorno informa o motivo da pendência.

## Produção
- `main`: não alterado;
- produção: não alterada;
- deploy: não executado;
- recursos Cloudflare reais: não provisionados nesta versão.

## Próximos passos
- validar CI da v0.16;
- integrar Course Builder com persistência D1 tenant-aware;
- criar gestão administrativa da política de conclusão na UI;
- implementar contrato definitivo de identidade com iFarm Core;
- provisionar STAGE quando os acessos estiverem disponíveis.
