# Changelog v0.71

- adiciona consulta canônica server-side ao Mercado Pago após HMAC do webhook;
- adiciona adapter tipado `_mercadoPagoProvider.ts` com timeout, host fixo e respostas PII-minimal;
- normaliza pagamentos, assinaturas, planos de assinatura e faturas autorizadas;
- correlaciona recursos por `external_reference` com checkout local;
- bloqueia divergência de valor/moeda/assinatura;
- integra recursos financeiros elegíveis ao processor verificado existente;
- persiste hash/snapshot canônico sem payload bruto do pagador;
- adiciona migration 0044 e estados `canonical_verified` / `processed` ao receipt;
- adiciona testes do provider e amplia fixture Mercado Pago;
- adiciona `MERCADOPAGO_REQUEST_TIMEOUT_MS`;
- atualiza readiness do provider;
- versão do app: 0.71.0.
