# Próximas camadas — iFarm Academy

## Concluído até v0.68
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
- Busca pública unificada tenant-aware, parceiros/bundles, curadoria editorial, SEO técnico e foundation de performance/acessibilidade.
- Marketplace foundation com submissão/revisão/publicação e comissão versionada sem percentual padrão.
- Motor comercial consentido, privacidade/revogação LGPD, outbox, handoff, conversão e worker boundary.
- Gamificação foundation e Notification Center in-app.
- Pipeline Cloudflare STAGE/PRODUCTION com isolamento de recursos e contratos de smoke/deploy.
- AI Tutor grounded com conteúdo autorizado, provider boundary, quotas/guardrails, Learning Tools e Learning Signals sem efeito em nota/certificação.
- Checkout & Payment Boundary v0.68:
  - checkout local com preço server-side imutável;
  - subscription permanece `pending_payment` até confirmação confiável;
  - ledger de eventos de provider idempotente/imutável;
  - projeção de estado de pagamento;
  - entitlement com evidência obrigatória;
  - provider Mercado Pago fail-closed mesmo com credenciais, até adapter homologado.
- 41 migrations versionadas e fixtures D1-compatible por módulo na v0.68.

## Próximas prioridades
1. **Streaming:** escolher/homologar provider e conectar adapter existente com credenciais exclusivas por ambiente.
2. **Mercado Pago adapter:** implementar criação de checkout/preference e verificação oficial de webhook em STAGE; somente depois habilitar `checkoutEnabled`.
3. **Payment processing & subscriptions:** transformar apenas eventos provider-verificados em ativação/renovação/cancelamento; políticas de refund/inadimplência continuam TBD.
4. **Checkout por usuário/licença:** definir regra corporativa de quantidade, proration e limites antes de habilitar preço `per_user`.
5. **Marketplace financeiro:** split, repasses, extrato e conciliação após definição de comissão/fiscal.
6. **Barramento oficial de notificações Core:** integrar quando o serviço/outbox real existir no Core.
7. **SLO/backup/restore real:** ativar sobre STAGE/PRODUCTION provisionados e medir RPO/RTO aprovados.
8. **Homologação e promoção:** executar matriz STAGE, corrigir findings e somente depois promover `main`/produção.

## Governança
- `develop` continua linha de integração; promoção para `stage`/`main` exige homologação e gates próprios.
- Não reutilizar secrets, bancos, tokens, buckets, IDs ou credenciais de outros projetos.
- iFarm Core é autoridade de identidade, tenant, membership, papel e capabilities; Academy não recria RBAC Core.
- Nenhuma periodicidade NR-31 é hardcoded; qualificação verificada não equivale a habilitação legal automática.
- Nenhum conteúdo técnico ausente nas fontes pode ser completado como fato pelo Tutor.
- Busca/curadoria pública não consulta histórico do visitante e não cria lead automaticamente.
- Evento pago não gera inscrição/entitlement sem confirmação confiável.
- Marketplace não assume percentual, split, repasse ou regra fiscal.
- White Label não executa CSS/HTML arbitrário nem provisiona DNS automaticamente.
- Checkout nunca confia em preço/status de pagamento enviados pelo browser.
- `payment_state=confirmed` exige evento provider-verificado; evento é idempotente e evidência imutável.
- Entitlement ativo exige evidência explícita e fonte válida; credencial de gateway, por si só, não habilita checkout.
- Plano `per_user` permanece sem checkout até definição/homologação de quantidade/licenças.
- Logs não devem registrar PII, secrets, respostas de prova ou corpos sensíveis.
- RPO, RTO, CNAE, regras fiscais, política de refund e percentual de comissão permanecem TBD até decisão humana.
