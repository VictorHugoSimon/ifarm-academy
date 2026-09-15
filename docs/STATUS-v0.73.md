# iFarm Academy v0.73 — Evidência auditável do período recorrente

## Objetivo
Eliminar qualquer inferência local de `period_end` no fluxo de cobrança recorrente. Pagamento confirmado e período de cobrança são evidências diferentes.

## Entregas
- migration `0046_billing_period_evidence.sql`;
- nova tabela append-only `academy_subscription_billing_period_evidence`;
- estados explícitos de evidência: `complete`, `partial`, `unavailable`;
- assinatura paga pode ser ativada por pagamento/provider canônico confirmado mesmo quando o provider ainda não informou o fim do período;
- pagamento confirmado continua exigindo `provider_payment_id` e `provider_subscription_id`;
- `period_start`/`period_end` deixam de ser requisito para confirmação financeira;
- webhook Mercado Pago não calcula mais `period_end` com calendário local;
- processador persiste somente limites de período recebidos do recurso canônico;
- ausência de limites também vira evidência auditável (`unavailable`);
- leitura administrativa de assinaturas expõe a evidência canônica mais recente;
- fixture dedicada no CI impede regressão para período inferido.

## Regra de verdade
A Academy nunca transforma `billing_interval=monthly|annual` em uma data que pareça ter sido retornada pelo provider.

- Se o provider informar início e fim: `complete`.
- Se informar apenas um limite: `partial`.
- Se não informar nenhum: `unavailable`.
- O timestamp de confirmação pode iniciar o acesso, mas não é rotulado como início do período de cobrança se o provider não o informou como tal.

## Segurança e auditoria
- evidência de período é append-only;
- hash SHA-256 do payload canônico é obrigatório;
- resource type/id e provider subscription id são obrigatórios;
- isolamento por tenant/checkout/subscription/payment event;
- datas completas precisam formar intervalo válido;
- nenhuma credencial é persistida na evidência.

## Compatibilidade histórica
Registros produzidos antes da v0.73 podem conter `period_start`/`period_end` no evento de pagamento seguindo a lógica legada. A migration não reescreve nem classifica retroativamente esses valores como evidência canônica. Evidência canônica v0.73+ existe somente na nova tabela append-only.

## Fora do escopo
- política de refund continua TBD;
- cobrança corporate/per-user continua TBD;
- nenhum secret real ou chamada de homologação é adicionada ao CI;
- nenhum deploy é realizado por esta release.

## Próximo bloco sugerido — v0.74
Fechar renovação/suspensão de entitlement a partir de eventos recorrentes canônicos, sem usar datas presumidas e sem decidir política de grace period sem regra comercial aprovada.
