# iFarm Academy — Status v0.73

## Verified Billing Period

A v0.73 separa definitivamente **evidência do provider** de **período comercial derivado pela Academy**.

### Regra de autoridade

- confirmação de pagamento continua vindo apenas de evento canônico verificado do provider;
- o provider pode informar data do pagamento, início de período e, eventualmente, fim de período;
- a cadência comercial (`monthly` ou `annual`) vem do snapshot imutável do checkout;
- `current_period_end` e `entitlement.ends_at` são calculados pela Academy usando a evidência temporal canônica + a cadência contratada;
- o período calculado é gravado em `academy_subscription_billing_periods` como evidência append-only;
- um `period_end` reportado pelo provider, quando existir, é preservado apenas para comparação e auditoria. Ele não é apresentado como a fonte do prazo calculado pela Academy.

### Integridade

A migration `0046_verified_billing_period.sql`:

- adiciona `provider_occurred_at` ao evento de pagamento;
- deixa de exigir `period_end` do provider em uma confirmação;
- exige pagamento, assinatura e evidência temporal canônica;
- cria o snapshot imutável do período derivado;
- impede ativação de assinatura paga sem esse snapshot;
- impede entitlement ativo com período diferente da assinatura;
- impede update/delete da evidência derivada.

### Calendário

O cálculo é feito em UTC e respeita o último dia válido do mês:

- 31/jan + mensal → 28/fev ou 29/fev;
- 29/fev + anual → 28/fev no ano seguinte não bissexto.

### Mercado Pago

O webhook não calcula mais o período. Ele entrega ao processador apenas os campos que vieram da consulta canônica ao Mercado Pago. Para pagamento `approved`, `date_approved` é preferido como ocorrência canônica; `date_last_updated` permanece fallback.

### Limites da release

- checkout externo continua fail-closed por feature flag;
- nenhuma credencial foi versionada;
- não define política de cancelamento, refund ou `past_due`;
- não implementa quantidade/licenças por usuário;
- não executa deploy em STAGE/PRODUCTION.

### CI

Além dos gates existentes, a v0.73 adiciona `integration_billing_period_contract.py` para provar derivação, imutabilidade, bloqueio de ativação direta e alinhamento do entitlement.
