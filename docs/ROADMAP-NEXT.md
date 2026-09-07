# Próximas camadas — iFarm Academy

## Concluído até v0.41
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
- Planos públicos em `/plans` e `/plans/{slug}` para público individual, corporativo e parceiro.
- Modos comerciais `free`, `priced` e `contact_sales` sem valores presumidos.
- Preços mensal/anual versionados e imutáveis, por assinatura ou por usuário.
- Benefícios de cursos, trilhas e referências ao ecossistema iFarm sem duplicar catálogo externo.
- `Subscription` preparada no banco; escrita/ativação permanece bloqueada até integração homologada.
- Trilhas, perfis e planos públicos respeitando o catálogo White Label e somente conteúdo publicamente elegível.
- CI com migrations, testes unitários e fixtures D1-compatible específicas por módulo.

## Próximas prioridades
1. Lockfile íntegro e migração do CI de `npm install` para `npm ci` quando puder ser gerado com integridade verificável.
2. Provisionamento exclusivo de Cloudflare Pages + D1 + storage para STAGE.
3. Integração definitiva com sessão/RBAC e barramento de notificações do iFarm Core, incluindo escopo confiável de `company_admin`.
4. Adapter do provedor de streaming escolhido após decisão de infraestrutura.
5. Checkout e Mercado Pago, incluindo cursos, trilhas, planos, eventos pagos e marketplace, após identity boundary e validações comerciais/fiscais.
6. Assinaturas reais, entitlement e cancelamento somente após eventos confiáveis de pagamento/contrato.
7. Marketplace financeiro: split, repasses, extrato e conciliação após definição comercial e fiscal.
8. IA Tutor com RAG autorizado após base de conteúdo, permissões e infraestrutura homologadas.
9. Portal avançado: busca enriquecida, recomendações, páginas de parceiros e bundles comerciais consentidos.
10. Alertas externos, backup/restore real, SLOs, gamificação e automações avançadas após STAGE.

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
- Plano `priced` público exige preço ativo explicitamente cadastrado; preços históricos nunca são sobrescritos.
- Plano `free` ou `contact_sales` não recebe preço financeiro artificial.
- Benefícios externos são referências; produto, estoque, contrato, crédito, seguro e elegibilidade continuam nos sistemas responsáveis.
- Assinatura paga ativa exige confirmação real do provedor; assinatura gratuita/contratual exige referência explícita de ativação.
- A v0.41 não possui endpoint de criação/ativação de assinatura.
- Logs não devem registrar PII, secrets, respostas de prova ou corpo de requisição.
- Rate limiting pode falhar aberto para disponibilidade; identity boundary permanece fail-closed.
- RPO, RTO, CNAE, regras fiscais e percentual de comissão do marketplace permanecem TBD.
