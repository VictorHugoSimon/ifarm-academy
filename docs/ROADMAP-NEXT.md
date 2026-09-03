# Próximas camadas — iFarm Academy

## Concluído até v0.34
- Identidade fail-closed preparada para integração com o iFarm Core.
- Isolamento tenant-aware em APIs administrativas e estudantis.
- Course Builder, Quiz Builder, publicação, catálogo, matrícula, Student Player, progresso e conclusão server-side.
- Correção manual auditável, ciclos acadêmicos recorrentes e certificados imutáveis.
- Editor seguro de conteúdo, materiais e mídia desacoplada do provedor.
- Área empresarial, trilhas, atribuições, renovações e relatórios.
- Eventos gerais com inscrição, capacidade, lista de espera e presença.
- Instrutores, qualificações, revisão e responsabilidade técnica auditável.
- Validade pública de certificados com política versionada e estados `valid`, `expired` e `revoked`.
- Relatórios acadêmicos, empresariais, eventos e governança técnica com CSV.
- Correlation ID, logging estruturado, liveness, readiness, rate limiting e painel operacional.
- Smart Farm Experience com agenda de campo, estações e atividades práticas.
- QR hash-only para check-in, check-out e evidência de estação.
- Landing de QR com confirmação do participante; nenhuma ação automática ao abrir o link.
- Evidências práticas pendentes/validadas/rejeitadas e revisão humana.
- Cross-sell da experiência de campo somente com consentimento explícito.
- Leads Smart Farm com origem, consentimento e pipeline comercial rastreáveis.
- CI com migrations, testes unitários e fixtures D1-compatible específicas por módulo.

## Próximas prioridades
1. Lockfile íntegro e migração do CI de `npm install` para `npm ci` quando puder ser gerado em ambiente com rede e integridade verificável.
2. Provisionamento exclusivo de Cloudflare Pages + D1 + storage para STAGE.
3. Integração definitiva com sessão/RBAC do iFarm Core, incluindo escopo confiável de `company_admin` por empresa.
4. Marketplace foundation: submissão, revisão, publicação e regras de comissão configuráveis sem percentual hardcoded.
5. White label foundation: identidade visual, domínio/catalog scope e certificados por tenant sem provisionar DNS automaticamente.
6. Adapter do provedor de streaming escolhido após decisão de infraestrutura.
7. Checkout e Mercado Pago, incluindo eventos pagos, após identity boundary real e validações comerciais/fiscais.
8. IA Tutor com RAG autorizado após a base de conteúdo, permissões e infraestrutura estarem homologadas.
9. Alertas externos, backup/restore real e SLOs após STAGE; RPO/RTO permanecem TBD.
10. Gamificação completa e automações comerciais avançadas após estabilização do MVP.

## Governança
- `develop` é a linha de integração.
- `main` e produção permanecem fora das mudanças até homologação do STAGE.
- Não reutilizar secrets, bancos, tokens, buckets ou recursos de outros projetos.
- O papel `company_admin` só deve ser liberado em homologação/produção quando o iFarm Core fornecer escopo confiável da empresa administrada.
- Nenhuma periodicidade regulatória deve ser hardcoded.
- Qualificação verificada não equivale a declaração automática de habilitação legal; responsabilidade técnica exige decisão humana registrada.
- Renovação de treinamento e validade pública do certificado são políticas independentes.
- Alterar política atual não reescreve certificados já emitidos.
- Evento pago não gera inscrição/entitlement sem checkout confirmado.
- Smart Farm Experience não gera lead a partir de presença, QR ou evidência prática; interesse comercial exige consentimento explícito.
- Token QR bruto não deve ser persistido; somente hash e metadados operacionais.
- Logs operacionais não devem registrar PII, secrets, respostas de prova ou corpo de requisição.
- Rate limiting pode falhar aberto para disponibilidade; identity boundary permanece fail-closed.
- RPO, RTO, CNAE, regras fiscais e percentual de comissão do marketplace permanecem TBD.
