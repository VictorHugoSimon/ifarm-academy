# iFarm Academy v0.68 — Checkout & Payment Boundary Foundation

## Objetivo
Preparar checkout, eventos de pagamento e entitlement sem ativar acesso por dado vindo do navegador e sem simular integração com Mercado Pago.

## Entregas
- migration `0041_checkout_payment_boundary.sql`;
- `academy_checkout_sessions` com snapshot imutável de preço server-side;
- `academy_payment_events` append-only/idempotente por provider event;
- `academy_payment_state` como projeção do estado atual;
- `academy_entitlements` com evidência obrigatória para acesso ativo;
- criação autenticada de checkout local para plano `priced` publicado;
- assinatura criada somente como `pending_payment`;
- reuse idempotente de checkout aberto para o mesmo usuário/plano/preço;
- ledger administrativo somente leitura;
- consulta de entitlements do usuário;
- readiness do provider sem exposição de secrets;
- máquina de estados de pagamento e normalização de evento verificado;
- fixture D1-compatible e gate específico no CI.

## Segurança
- preço/valor/moeda/versionamento vêm exclusivamente de `academy_plan_prices` ativo no servidor;
- browser não informa `paid`, provider event, entitlement ou subscription `active`;
- `payment_state=confirmed` exige evento verificado persistido;
- evento de provider é único e evidência é imutável;
- entitlement ativo exige evidência explícita e, quando originado de subscription, subscription já ativa;
- cross-tenant é bloqueado no banco;
- plano `per_user` permanece bloqueado no checkout até política de quantidade/licenças ser homologada;
- credencial presente não habilita checkout automaticamente.

## Mercado Pago
A v0.68 apenas declara o boundary e os bindings futuros. Não existe chamada outbound, criação de preferência, verificação de assinatura ou webhook ativo. `checkoutEnabled=false` e `webhookVerificationEnabled=false` até uma release específica do adapter passar por homologação.

## Decisões ainda humanas
- regras fiscais/CNAE/documento fiscal;
- política de cancelamento/refund;
- cobrança corporativa por usuário/licença;
- recorrência/renovação e inadimplência;
- credenciais exclusivas de STAGE;
- aprovação final do fluxo Mercado Pago.
