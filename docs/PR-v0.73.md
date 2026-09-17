# PR v0.73 — Verified Billing Period

## Objetivo
Separar evidência canônica do provider da derivação do período comercial da assinatura.

## Principais mudanças
- pagamento confirmado não exige `period_end` vindo do provider;
- persiste `provider_occurred_at` como evidência canônica;
- deriva `current_period_end` usando `checkout.billing_interval` imutável;
- grava proveniência append-only em `academy_subscription_billing_periods`;
- impede assinatura paga ativa sem evidência derivada;
- impede entitlement com período divergente;
- cálculo UTC correto para fim de mês/ano bissexto;
- webhook Mercado Pago não deriva mais período;
- leitura administrativa deixa explícito que o prazo é calculado pela Academy.

## Gate
Merge apenas com CI integralmente verde: TypeScript, unit tests, 46 migrations, fixtures e build.

## Fora de escopo
Sem credenciais, sem homologação STAGE, sem política de refund/cancelamento/past_due e sem deploy.
