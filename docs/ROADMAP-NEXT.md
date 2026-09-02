# Próximas camadas — iFarm Academy

## Concluído até v0.26
- Identidade fail-closed preparada para integração com o iFarm Core.
- Isolamento tenant-aware em APIs administrativas e estudantis.
- Course Builder persistido em API/D1.
- Quiz Builder server-side com política versionada.
- Correção manual auditável.
- Workflow `draft → review → published → archived`.
- Catálogo tenant-aware e matrícula server-side.
- Student Player consumindo curso matriculado do D1.
- Progresso server-side por aula e posição de retomada.
- Avaliação estudantil server-side sem exposição do gabarito.
- Conclusão automática da matrícula e certificação após requisitos reais.
- Editor e renderização segura de `content_json` por tipo de aula.
- Storage de materiais e contrato de mídia desacoplado do provedor.
- Snapshot acadêmico imutável no certificado.
- Página pública de validação e QR Code local.
- Testes HTTP das Pages Functions e fixtures D1-compatible.
- CI com migrations, integração de banco, typecheck, testes e build.
- Área empresarial com cadastro de empresas.
- Cadastro de colaboradores vinculado ao `userId` do ecossistema iFarm.
- Atribuição de curso publicado com obrigatoriedade e prazo.
- Matrícula conciliada automaticamente ao atribuir um curso.
- Conclusões existentes são preservadas e nunca reabertas pela atribuição corporativa.
- Cancelamento de atribuição não remove automaticamente a matrícula, evitando perda indevida de entitlement.
- Painel empresarial com colaboradores, atribuições, conclusão, atrasos e certificados.
- Gate de integração específico para isolamento tenant/company/member/course.

## Próximas prioridades
1. Lockfile íntegro e migração do CI de `npm install` para `npm ci`.
2. Provisionamento exclusivo de Cloudflare Pages + D1 + storage para STAGE.
3. Integração definitiva com sessão/RBAC do iFarm Core, incluindo escopo confiável de `company_admin` por empresa.
4. Trilhas empresariais obrigatórias e regras de renovação de treinamento.
5. Eventos/Smart Farm Experience conectados a inscrições e presença.
6. Gestão de instrutores, qualificações e responsabilidade técnica.
7. Adapter do provedor de streaming escolhido após decisão de infraestrutura.
8. Relatórios acadêmicos essenciais do MVP.
9. Checkout e Mercado Pago após identity boundary real e validações comerciais/fiscais.
10. Hardening operacional: observabilidade, backup/restore, rate limiting e alertas.

## Governança
- `develop` é a linha de integração.
- `main` e produção permanecem fora das mudanças até homologação do STAGE.
- Não reutilizar secrets, bancos, tokens, buckets ou recursos de outros projetos.
- O papel `company_admin` só deve ser liberado em homologação/produção quando o iFarm Core fornecer escopo confiável da empresa administrada.
- CNAE, regras fiscais e percentual de comissão do marketplace permanecem TBD.
