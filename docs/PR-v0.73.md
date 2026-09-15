# PR v0.73 — Billing Period Evidence

## Problema corrigido
O webhook Mercado Pago ainda conseguia derivar `period_end` somando o intervalo comercial ao timestamp disponível. Isso misturava confirmação de pagamento com evidência de ciclo recorrente.

## Solução
- remover cálculo local de período;
- ativar assinatura paga pela evidência canônica de pagamento/assinatura;
- persistir período separadamente como evidência append-only;
- aceitar estado explícito `unavailable` quando o provider não retornar limites;
- preservar `null` em vez de fabricar datas.

## Gate
Merge somente com CI integralmente verde, incluindo migration 0046 e fixture de billing period evidence.
