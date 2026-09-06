# Próximas camadas — iFarm Academy

## Concluído até v0.36
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
- Smart Farm Experience com agenda de campo, QR hash-only, evidência prática e leads com consentimento explícito.
- Marketplace com submissão, revisão, publicação governada e regras de comissão versionadas sem percentual padrão.
- White Label por tenant com identidade visual controlada e fallback iFarm.
- Domínios white label com estados `pending`, `verified` e `disabled`, sem provisionamento DNS automático.
- Catálogo white label em modo todos os cursos ou seleção explícita com destaque.
- Catálogo acadêmico e marketplace respeitando o scope do tenant.
- Snapshot imutável da marca em certificados novos e renderização pública da marca preservada.
- CI com migrations, testes unitários e fixtures D1-compatible específicas por módulo.

## Próximas prioridades
1. Lockfile íntegro e migração do CI de `npm install` para `npm ci` quando puder ser gerado em ambiente com rede e integridade verificável.
2. Provisionamento exclusivo de Cloudflare Pages + D1 + storage para STAGE.
3. Integração definitiva com sessão/RBAC do iFarm Core, incluindo escopo confiável de `company_admin` por empresa.
4. Adapter do provedor de streaming escolhido após decisão de infraestrutura.
5. Checkout e Mercado Pago, incluindo eventos pagos e marketplace, após identity boundary real e validações comerciais/fiscais.
6. Marketplace financeiro: split, repasses, extrato e conciliação após definição comercial e fiscal.
7. IA Tutor com RAG autorizado após a base de conteúdo, permissões e infraestrutura estarem homologadas.
8. Alertas externos, backup/restore real e SLOs após STAGE; RPO/RTO permanecem TBD.
9. White label avançado: e-mail, assets dedicados e automação de domínio somente após infraestrutura homologada.
10. Gamificação completa e automações comerciais avançadas após estabilização do MVP.

## Governança
- `develop` é a linha de integração.
- `main` e produção permanecem fora das mudanças até homologação do STAGE.
- Não reutilizar secrets, bancos, tokens, buckets ou recursos de outros projetos.
- O papel `company_admin` só deve ser liberado em homologação/produção quando o iFarm Core fornecer escopo confiável da empresa administrada.
- Nenhuma periodicidade regulatória deve ser hardcoded.
- Qualificação verificada não equivale a declaração automática de habilitação legal; responsabilidade técnica exige decisão humana registrada.
- Renovação de treinamento e validade pública do certificado são políticas independentes.
- Alterar política atual ou marca atual não reescreve certificados já emitidos.
- Evento pago não gera inscrição/entitlement sem checkout confirmado.
- Smart Farm Experience não gera lead a partir de presença, QR ou evidência prática; interesse comercial exige consentimento explícito.
- Token QR bruto não deve ser persistido; somente hash e metadados operacionais.
- Marketplace não assume percentual, preço, split, repasse ou regra fiscal; toda regra comercial deve ser explícita e versionada.
- White Label não executa CSS/HTML arbitrário nem provisiona DNS automaticamente.
- Domínio white label só pode ser registrado como verificado após evidência humana por `ifarm_admin`.
- Logs operacionais não devem registrar PII, secrets, respostas de prova ou corpo de requisição.
- Rate limiting pode falhar aberto para disponibilidade; identity boundary permanece fail-closed.
- RPO, RTO, CNAE, regras fiscais e percentual de comissão do marketplace permanecem TBD.
