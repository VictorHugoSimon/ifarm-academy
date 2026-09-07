# Próximas camadas — iFarm Academy

## Concluído até v0.40
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
- White Label por tenant com identidade visual controlada, domínio governado, catálogo selecionável e snapshot de marca em certificados.
- Gamificação foundation com XP configurável, ledger idempotente, níveis, badges e streak, desacoplada de nota/certificado/compliance.
- Notification Center in-app com inbox, prioridades, preferências e deduplicação; canais externos permanecem desligados.
- Portal público tenant-aware com home, catálogo, detalhe de curso, eventos, `/app` separado e tenant resolvido somente por host aprovado.
- Trilhas públicas comerciais em `/paths` e `/paths/{slug}`, separadas das trilhas empresariais obrigatórias.
- Perfis públicos de instrutor em `/instructors` e `/instructors/{slug}`, vinculados ao cadastro existente e sem exposição automática de evidências/registro profissional.
- Trilhas e perfis públicos respeitando o catálogo White Label e somente cursos publicamente elegíveis.
- CI com migrations, testes unitários e fixtures D1-compatible específicas por módulo.

## Próximas prioridades
1. Lockfile íntegro e migração do CI de `npm install` para `npm ci` quando puder ser gerado com integridade verificável.
2. Provisionamento exclusivo de Cloudflare Pages + D1 + storage para STAGE.
3. Integração definitiva com sessão/RBAC e barramento de notificações do iFarm Core, incluindo escopo confiável de `company_admin`.
4. Adapter do provedor de streaming escolhido após decisão de infraestrutura.
5. Checkout e Mercado Pago, incluindo cursos, trilhas, eventos pagos e marketplace, após identity boundary e validações comerciais/fiscais.
6. Marketplace financeiro: split, repasses, extrato e conciliação após definição comercial e fiscal.
7. IA Tutor com RAG autorizado após base de conteúdo, permissões e infraestrutura homologadas.
8. Portal avançado: planos/assinaturas, recomendações, busca enriquecida, páginas de parceiros e bundles.
9. Alertas externos, backup/restore real e SLOs após STAGE; RPO/RTO permanecem TBD.
10. Gamificação, white label e automações comerciais avançadas após estabilização do MVP.

## Governança
- `develop` é a linha de integração; `main` e produção permanecem fora das mudanças até homologação do STAGE.
- Não reutilizar secrets, bancos, tokens, buckets ou recursos de outros projetos.
- `company_admin` só deve ser liberado com escopo confiável fornecido pelo iFarm Core.
- Nenhuma periodicidade regulatória deve ser hardcoded.
- Qualificação verificada não equivale a habilitação legal automática; responsabilidade técnica exige decisão humana registrada.
- Renovação de treinamento e validade pública do certificado são políticas independentes.
- Evento pago não gera inscrição/entitlement sem checkout confirmado.
- Smart Farm Experience só gera lead com consentimento explícito; token QR bruto não é persistido.
- Marketplace não assume percentual, split, repasse ou regra fiscal; toda regra comercial deve ser explícita/versionada.
- White Label não executa CSS/HTML arbitrário nem provisiona DNS automaticamente.
- Gamificação não altera nota, carga horária, elegibilidade de certificado ou conformidade; nenhum XP padrão é presumido.
- Notification Center não substitui o futuro barramento oficial do iFarm Core; e-mail, push e WhatsApp continuam desativados.
- Portal público nunca aceita `tenantId` informado pelo visitante; tenant é derivado do hostname aprovado/configurado.
- Conteúdo premium, gabarito, materiais protegidos e links privados não podem ser expostos pelo contrato público.
- Perfil público de instrutor é opt-in e não publica automaticamente evidências, número de conselho, registro profissional ou decisão de responsabilidade técnica.
- Trilhas públicas não herdam obrigatoriedade, renovação ou periodicidade das trilhas empresariais.
- Logs não devem registrar PII, secrets, respostas de prova ou corpo de requisição.
- Rate limiting pode falhar aberto para disponibilidade; identity boundary permanece fail-closed.
- RPO, RTO, CNAE, regras fiscais e percentual de comissão do marketplace permanecem TBD.
