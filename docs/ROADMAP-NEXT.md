# Próximas camadas — iFarm Academy

## Concluído até v0.33
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
- Área empresarial, trilhas, renovação configurável e ciclos acadêmicos auditáveis.
- Eventos, Smart Farm Experience, inscrições, lista de espera e presença.
- Instrutores, qualificações, papéis e responsabilidade técnica auditável.
- Relatórios acadêmicos, empresariais, eventos e governança técnica com CSV.
- Política de validade de certificado por curso com histórico versionado.
- Snapshot imutável da validade e situação pública `valid`, `expired` e `revoked`.
- Correlation ID global em `x-request-id`.
- Logging JSON estruturado sem corpo de requisição nem PII.
- Liveness `/api/health` e readiness `/api/readiness`.
- Rate limiting persistente D1 com identidade transformada por SHA-256.
- Painel administrativo de operações e eventos operacionais das últimas 24 horas.
- Runbook de incidente, observabilidade e preparação de backup/restore.
- CI com migrations, testes unitários e fixtures D1-compatible específicas por módulo.

## Próximas prioridades
1. Lockfile íntegro e migração do CI de `npm install` para `npm ci` quando puder ser gerado em ambiente com rede e integridade verificável.
2. Provisionamento exclusivo de Cloudflare Pages + D1 + storage para STAGE.
3. Integração definitiva com sessão/RBAC do iFarm Core, incluindo escopo confiável de `company_admin` por empresa.
4. Evolução Smart Farm Experience: QR/check-in, evidência prática, agenda de campo e integração com cross-sell.
5. Adapter do provedor de streaming escolhido após decisão de infraestrutura.
6. Checkout e Mercado Pago, incluindo eventos pagos, após identity boundary real e validações comerciais/fiscais.
7. Marketplace avançado, repasses e comissionamento após definição comercial.
8. IA Tutor com RAG autorizado após a base de conteúdo, permissões e infraestrutura estarem homologadas.
9. White label avançado e automações comerciais após estabilização do MVP.
10. Alertas externos, backup/restore real e SLOs após STAGE; RPO/RTO permanecem TBD.

## Governança
- `develop` é a linha de integração.
- `main` e produção permanecem fora das mudanças até homologação do STAGE.
- Não reutilizar secrets, bancos, tokens, buckets ou recursos de outros projetos.
- O papel `company_admin` só deve ser liberado em homologação/produção quando o iFarm Core fornecer escopo confiável da empresa administrada.
- Nenhuma periodicidade regulatória deve ser hardcoded.
- Qualificação verificada não equivale a declaração automática de habilitação legal; responsabilidade técnica exige decisão humana registrada.
- Renovação de treinamento e validade pública do certificado são políticas independentes.
- Ausência de política temporal no certificado não significa validade regulatória indefinida.
- Alterar a política atual não reescreve certificados já emitidos.
- Evento pago não gera inscrição/entitlement sem checkout confirmado.
- Logs operacionais não devem registrar PII, secrets, respostas de prova ou corpo de requisição.
- Rate limiting pode falhar aberto para disponibilidade; identity boundary permanece fail-closed.
- RPO, RTO, CNAE, regras fiscais e percentual de comissão do marketplace permanecem TBD.
