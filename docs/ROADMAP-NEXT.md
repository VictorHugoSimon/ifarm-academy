# Próximas camadas — iFarm Academy

## Concluído até v0.31
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
- Relatórios acadêmicos do MVP com filtro de período.
- Relatórios empresariais com conclusão, atrasos e renovações.
- Relatórios de eventos com ocupação, presença e Smart Farm Experience.
- Relatório de cobertura de governança técnica para treinamentos regulatórios.
- Exportação CSV por bloco de relatório.
- Gates específicos de CI para ciclos, eventos, instrutores e relatórios.

## Próximas prioridades
1. Lockfile íntegro e migração do CI de `npm install` para `npm ci` quando puder ser gerado em ambiente com rede e integridade verificável.
2. Provisionamento exclusivo de Cloudflare Pages + D1 + storage para STAGE.
3. Integração definitiva com sessão/RBAC do iFarm Core, incluindo escopo confiável de `company_admin` por empresa.
4. Governança de validade/expiração pública de certificados regulatórios.
5. Hardening operacional: observabilidade, backup/restore, rate limiting e alertas.
6. Adapter do provedor de streaming escolhido após decisão de infraestrutura.
7. Checkout e Mercado Pago, incluindo eventos pagos, após identity boundary real e validações comerciais/fiscais.
8. Evolução Smart Farm Experience: QR/check-in, evidência prática, agenda de campo e integração com cross-sell.
9. Marketplace avançado, repasses e comissionamento após definição comercial.
10. IA Tutor com RAG autorizado após a base de conteúdo, permissões e infraestrutura estarem homologadas.

## Governança
- `develop` é a linha de integração.
- `main` e produção permanecem fora das mudanças até homologação do STAGE.
- Não reutilizar secrets, bancos, tokens, buckets ou recursos de outros projetos.
- O papel `company_admin` só deve ser liberado em homologação/produção quando o iFarm Core fornecer escopo confiável da empresa administrada.
- Nenhuma periodicidade regulatória deve ser hardcoded.
- Qualificação verificada não equivale a declaração automática de habilitação legal; responsabilidade técnica exige decisão humana registrada.
- A seção de governança técnica dos relatórios não constitui parecer de conformidade legal.
- Iniciar novo ciclo de treinamento não revoga automaticamente certificado anterior; validade pública deve ser política explícita.
- Evento pago não gera inscrição/entitlement sem checkout confirmado.
- CNAE, regras fiscais e percentual de comissão do marketplace permanecem TBD.
