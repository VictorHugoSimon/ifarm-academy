# iFarm Academy v0.69 — Verified Payment Processor

## Objetivo
Transformar somente eventos já verificados por um adapter de pagamento confiável em estado financeiro, ativação de subscription e entitlement.

## Entregas
- migration `0042_verified_payment_processing.sql`;
- evidência adicional em eventos confirmados: `provider_subscription_id`, `period_start`, `period_end`;
- `processVerifiedPaymentEvent` provider-neutral e idempotente;
- ativação server-side de `academy_subscriptions` apenas após evento `confirmed` válido;
- ativação/upsert de entitlement ligada à subscription ativada;
- processamento de `pending`, `failed`, `cancelled`, `confirmed` e `refunded` pela máquina de estados;
- rejeição de reutilização do mesmo provider event em outro checkout;
- histórico `academy_payment_processing_log`;
- payment ledger ampliado com período/evidência de processamento;
- fixture dedicada ao processor e gate no CI.

## Regra de confirmação
Um evento `confirmed` precisa trazer, além do valor/moeda corretos e hash do payload:
- provider event id;
- provider payment id;
- provider subscription id;
- início do período;
- fim do período maior que o início;
- timestamp de verificação.

Sem isso, ele não é normalizado nem aceito pelo banco.

## Refund
A v0.69 atualiza `payment_state` para `refunded`, mas não revoga subscription/entitlement automaticamente. Política de refund/cancelamento de acesso permanece decisão humana/fiscal TBD e não será inferida pelo código.

## Boundary externo
O processor não verifica assinatura do Mercado Pago e não recebe request público. Ele é um serviço interno destinado ao adapter que será implementado/homologado em release específica. O browser continua sem capacidade de escrever eventos de pagamento ou ativar acesso.
