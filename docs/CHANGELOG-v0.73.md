# Changelog v0.73

## Added

- `functions/api/_billingPeriod.ts` com cálculo de período mensal/anual seguro para fim de mês e ano bissexto.
- Migration `0046_verified_billing_period.sql`.
- Tabela append-only `academy_subscription_billing_periods`.
- Proveniência explícita de início/fim do período e comparação com prazo eventualmente reportado pelo provider.
- Fixture `integration_billing_period_contract.py` e gate dedicado no CI.
- Proveniência do período na leitura administrativa de assinaturas.

## Changed

- Evento confirmado não exige mais `period_end` do provider.
- `provider_occurred_at` passa a ser evidência canônica persistida.
- Mercado Pago webhook deixou de derivar período localmente.
- Processador de pagamento deriva `current_period_end` exclusivamente da evidência temporal verificada + `checkout.billing_interval` imutável.
- Pagamento Mercado Pago aprovado prioriza `date_approved` como ocorrência canônica.
- Assinatura paga e entitlement ativo agora exigem período derivado coerente no banco.

## Security / Integrity

- `period_end` derivado não pode ser falsamente atribuído ao Mercado Pago.
- Evidência de billing period não pode ser atualizada nem excluída.
- Escrita direta não consegue ativar assinatura paga sem evidência derivada.
- Entitlement não pode divergir do período da assinatura.

## Not included

- credenciais ou homologação STAGE do Mercado Pago;
- cancelamento/refund/past_due comercial;
- checkout per-user/licenças;
- deploy em produção.
