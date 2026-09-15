# Próximas camadas — iFarm Academy

## Concluído até v0.72
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
- Pagamentos v0.68–v0.72:
  - checkout local com preço server-side imutável;
  - subscription começa `pending_payment`;
  - ledger provider idempotente/imutável e estado financeiro projetado;
  - entitlement exige evidência explícita;
  - processor interno ativa subscription/entitlement somente com evento confirmado contendo payment id, subscription id e período verificados;
  - Webhook Mercado Pago valida HMAC;
  - recurso canônico do Mercado Pago é consultado server-side antes da transição financeira;
  - criação de preapproval `pending` usa snapshot local, e-mail validado pelo iFarm Core, `external_reference=checkoutId` e idempotência estável;
  - URL de checkout só é devolvida após correlação da resposta do provider;
  - criação externa é protegida por feature flag e fica desligada por padrão em STAGE;
  - nenhum retorno de criação ativa entitlement;
  - refund registra estado financeiro, mas não revoga acesso sem política aprovada.
- 45 migrations versionadas após v0.72, com fixtures D1-compatible por módulo.

## Próximas prioridades técnicas
1. **Período de renovação verificado:** derivar fim de período usando pagamento canônico + intervalo comercial imutável, registrando a proveniência da evidência; nunca fingir que `period_end` veio do provider.
2. **Homologação Mercado Pago STAGE:** cadastrar Access Token/Webhook Secret exclusivos, validar URL de retorno e só então ativar `ACADEMY_PAYMENT_CHECKOUT_ENABLED=true`.
3. **Renewal/past_due/cancelamento:** mapear os recursos canônicos recorrentes para os estados locais após política comercial aprovada.
4. **Checkout por usuário/licença:** definir quantidade, proration, assentos e limites antes de habilitar `price_unit=per_user`.
5. **Streaming:** escolher/homologar provider e conectar o adapter existente com credenciais exclusivas por ambiente.
6. **Marketplace financeiro:** split, repasses, extrato e conciliação após definição de comissão/fiscal.
7. **Barramento oficial de notificações Core:** integrar quando o serviço/outbox real existir no Core.
8. **SLO/backup/restore real:** ativar sobre STAGE/PRODUCTION provisionados e medir RPO/RTO aprovados.
9. **Release Candidate:** executar preflight automático, matriz STAGE, corrigir findings e somente depois promover `main`/produção.

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
- Checkout nunca confia em preço, moeda, payer email ou status de pagamento enviados pelo browser.
- Criação no provider é idempotente e permanece separada da ativação de acesso.
- `payment_state=confirmed` exige evento provider-verificado; evento é idempotente e evidência imutável.
- Entitlement ativo exige evidência explícita e subscription ativa; credencial de gateway, por si só, não habilita checkout.
- Refund não revoga acesso automaticamente enquanto a política estiver TBD.
- Plano `per_user` permanece sem checkout até definição/homologação de quantidade/licenças.
- Logs não devem registrar PII, secrets, respostas de prova ou corpos sensíveis.
- RPO, RTO, CNAE, regras fiscais, política de refund e percentual de comissão permanecem TBD até decisão humana.
