# Próximas camadas — iFarm Academy

## Concluído até v0.32
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
- Área empresarial com empresas e colaboradores vinculados ao `userId` iFarm.
- Atribuição de curso publicado com obrigatoriedade e prazo.
- Trilhas empresariais, renovação configurável e ciclos acadêmicos auditáveis.
- Progresso, avaliações e certificados isolados por ciclo.
- Renovação empresarial criando ciclo novo sem copiar estado acadêmico anterior.
- Eventos para workshops, dias de campo, aulas práticas, treinamentos e webinars.
- Eventos gratuitos, patrocinados e pagos modelados sem contornar checkout.
- Smart Farm Experience identificável como fazenda-escola/laboratório vivo.
- Inscrição de participante com capacidade e lista de espera.
- Gestão de presença, check-in, checkout, ausência e evidências.
- Cadastro de instrutor reutilizando identidade do iFarm.
- Qualificações técnicas/profissionais com evidência e status de verificação.
- Papéis de autor, instrutor, revisor e responsável técnico por curso.
- Responsabilidade técnica condicionada a qualificação verificada e confirmação humana explícita.
- Relatórios acadêmicos, empresariais, eventos e governança técnica.
- Exportação CSV por bloco de relatório.
- Política de validade de certificado por curso com confirmação humana explícita.
- Histórico versionado das políticas de validade.
- Snapshot imutável de validade em cada certificado emitido.
- Situação pública `valid`, `expired` e `revoked` calculada sem reescrever histórico.
- Ausência de política tratada como `not_configured`, nunca como validade indefinida.
- Relatório de certificados regulatórios expirados, próximos do vencimento e sem política temporal.
- Gates específicos de CI para ciclos, eventos, instrutores, relatórios e validade de certificados.

## Próximas prioridades
1. Lockfile íntegro e migração do CI de `npm install` para `npm ci` quando puder ser gerado em ambiente com rede e integridade verificável.
2. Provisionamento exclusivo de Cloudflare Pages + D1 + storage para STAGE.
3. Integração definitiva com sessão/RBAC do iFarm Core, incluindo escopo confiável de `company_admin` por empresa.
4. Hardening operacional: request correlation, health/readiness, observabilidade, rate limiting, backup/restore e alertas.
5. Evolução Smart Farm Experience: QR/check-in, evidência prática, agenda de campo e integração com cross-sell.
6. Adapter do provedor de streaming escolhido após decisão de infraestrutura.
7. Checkout e Mercado Pago, incluindo eventos pagos, após identity boundary real e validações comerciais/fiscais.
8. Marketplace avançado, repasses e comissionamento após definição comercial.
9. IA Tutor com RAG autorizado após a base de conteúdo, permissões e infraestrutura estarem homologadas.
10. White label avançado e automações comerciais após estabilização do MVP.

## Governança
- `develop` é a linha de integração.
- `main` e produção permanecem fora das mudanças até homologação do STAGE.
- Não reutilizar secrets, bancos, tokens, buckets ou recursos de outros projetos.
- O papel `company_admin` só deve ser liberado em homologação/produção quando o iFarm Core fornecer escopo confiável da empresa administrada.
- Nenhuma periodicidade regulatória deve ser hardcoded.
- Qualificação verificada não equivale a declaração automática de habilitação legal; responsabilidade técnica exige decisão humana registrada.
- A seção de governança técnica dos relatórios não constitui parecer de conformidade legal.
- Renovação de treinamento e validade pública do certificado são políticas independentes.
- Ausência de política temporal no certificado não significa validade regulatória indefinida.
- Alterar a política atual não reescreve certificados já emitidos.
- Evento pago não gera inscrição/entitlement sem checkout confirmado.
- CNAE, regras fiscais e percentual de comissão do marketplace permanecem TBD.
