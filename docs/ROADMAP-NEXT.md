# Próximas camadas — iFarm Academy

## Concluído até v0.64
- Núcleo LMS: Course Builder, módulos, aulas, conteúdos, quiz, publicação, matrícula, Student Player, progresso, ciclos acadêmicos, conclusão e certificados.
- Correção automática/manual auditável e políticas de avaliação versionadas.
- Certificado imutável com QR, validação pública, marca snapshot e política de validade versionada.
- Multi-tenant, auditoria, rate limiting, health/readiness, logs estruturados e hardening operacional.
- Integração de identidade com iFarm Core usando Neon Auth, tenant/RBAC/MFA e capabilities verificadas; sem login paralelo.
- Frontend protegido com Bearer explícito; superfícies públicas permanecem anônimas.
- Área empresarial, colaboradores, atribuições, trilhas obrigatórias, renovações e ciclos recorrentes.
- Eventos, Smart Farm Experience, QR/check-in, evidências práticas e leads consentidos.
- Instrutores, qualificações, revisão e responsabilidade técnica com confirmação humana.
- Portal público, catálogo, trilhas públicas, perfis de instrutor, planos e ofertas White Label.
- Busca pública unificada tenant-aware em cursos, trilhas, instrutores, eventos, planos, parceiros e bundles, com filtros/facets e ranking textual determinístico sem perfilamento comportamental.
- Parceiros públicos por referência e bundles com cursos, trilhas, planos e itens externos, sem duplicar cadastros mestres/estoque/contratos do ecossistema.
- Recomendações contextuais públicas em curso, bundle e parceiro, derivadas apenas do conteúdo atual, sem histórico do visitante, perfilamento ou geração automática de lead.
- Marketplace foundation com submissão/revisão/publicação e comissão versionada sem percentual padrão.
- Motor comercial consentido, privacidade/revogação LGPD, outbox, handoff, conversão e worker boundary.
- Gamificação foundation e Notification Center in-app.
- Lockfile íntegro e CI determinístico com `npm ci`.
- Pipeline Cloudflare STAGE/PRODUCTION com isolamento de recursos e contratos de smoke/deploy.
- AI Tutor v0.56–v0.61 com fontes autorizadas, `evidence_only`, provider-neutral opcional, opt-in de geração, quotas, guardrails, Learning Tools e Learning Signals sem efeito em nota/certificação ou perfil comercial.
- 39 migrations versionadas e fixtures D1-compatible por módulo; v0.64 não adiciona migration.

## Próximas prioridades
1. **Streaming:** escolher/homologar provider e conectar adapter existente com credenciais exclusivas por ambiente.
2. **Checkout/Mercado Pago:** cursos, trilhas, planos, eventos, bundles e marketplace após validação comercial/fiscal; nenhum entitlement antes de confirmação confiável.
3. **Subscriptions & entitlements:** ativação, renovação e cancelamento por eventos confiáveis de pagamento/contrato.
4. **Marketplace financeiro:** split, repasses, extrato e conciliação após definição de comissão/fiscal.
5. **Barramento oficial de notificações Core:** integrar quando o serviço/outbox real existir no Core; hoje apenas capabilities foram encontradas.
6. **Portal avançado:** expandir descoberta contextual para trilhas, planos e eventos; qualquer recomendação comercial baseada em identidade/interesse deve permanecer consentida e auditável.
7. **SLO/backup/restore real:** ativar sobre STAGE/PRODUCTION provisionados e medir RPO/RTO aprovados.
8. **Homologação e promoção:** executar matriz STAGE, corrigir findings e somente depois promover `main`/produção.

## Governança
- `develop` continua linha de integração; promoção para `stage`/`main` exige homologação e gates próprios.
- Não reutilizar secrets, bancos, tokens, buckets, IDs ou credenciais de outros projetos.
- iFarm Core é autoridade de identidade, tenant, membership, papel e capabilities; Academy não recria RBAC Core.
- `company_admin`/enterprise manager só existe por capabilities verificadas e MFA quando aplicável.
- Nenhuma periodicidade NR-31 é hardcoded.
- Qualificação verificada não equivale a habilitação legal automática; responsabilidade técnica exige decisão humana registrada.
- Curso publicado não implica autorização para IA; conteúdo e geração externa possuem aprovações independentes.
- Provider externo do Tutor é opcional e `evidence_only` permanece fallback permanente.
- Geração externa exige conteúdo autorizado, versão aprovada, provider configurado, evidência, opt-in, quota ativa e guardrails liberados.
- Quotas não possuem valores padrão; chamadas/caracteres não são apresentados como tokens ou custo financeiro.
- Nenhum conteúdo técnico ausente nas fontes pode ser completado como fato pelo Tutor.
- Learning Tools não escrevem em avaliação, nota, progresso, conclusão ou certificado.
- Learning Signals são efêmeros/read-only e não podem ser reutilizados para diagnóstico ou perfil comercial automático.
- Busca e recomendações públicas não consultam histórico do visitante, não criam lead e não fazem perfilamento comportamental/comercial.
- Parceiros públicos são projeções por referência; a Academy não assume cadastro mestre, contrato ou dados privados do sistema de origem.
- Bundles não duplicam estoque, produto, apólice, crédito, contrato ou entitlement e não habilitam checkout por si só.
- Evento pago não gera inscrição/entitlement sem confirmação de checkout.
- Marketplace não assume percentual, split, repasse ou regra fiscal; tudo deve ser explícito/versionado.
- White Label não executa CSS/HTML arbitrário nem provisiona DNS automaticamente.
- Logs não devem registrar PII, secrets, respostas de prova ou corpos sensíveis.
- RPO, RTO, CNAE, regras fiscais, política de refund e percentual de comissão permanecem TBD até decisão humana.
