# iFarm Academy v0.71 — Mercado Pago Canonical Verification

## Objetivo

Fechar a lacuna entre o webhook HMAC da v0.70 e o processador financeiro verificado já existente. A assinatura do webhook prova a origem da notificação; a v0.71 passa a consultar o recurso canônico no Mercado Pago antes de qualquer transição financeira ou ativação de acesso.

## Entregue

- adapter server-side para recursos canônicos Mercado Pago;
- endpoints oficiais fixos para `payment`, `preapproval`, `preapproval_plan` e `authorized_payment`;
- Bearer Access Token somente no servidor;
- timeout configurável e limitado;
- normalização PII-minimal: IDs, status, referência externa, valor, moeda e datas necessárias;
- SHA-256 do recurso canônico sem persistir payload bruto/pagador/cartão;
- correlação por `external_reference` com checkout Academy;
- validação de valor e moeda contra snapshot comercial imutável;
- receipt com evidência canônica write-once e estados `canonical_verified` / `processed`;
- retry seguro para falhas transitórias de consulta ao provider;
- integração com o `processVerifiedPaymentEvent` somente após correlação canônica;
- pagamento confirmado sem evidência de assinatura/período permanece `canonical_verified`, sem entitlement;
- readiness passa a informar `canonicalResourceFetchEnabled` quando Webhook Secret + Access Token existem;
- migration `0044_mercadopago_canonical_resources.sql`;
- testes unitários do adapter e fixture SQLite do ledger canônico.

## Segurança

- nenhuma credencial em `VITE_*`;
- host do provider é fixo em `https://api.mercadopago.com`;
- o navegador nunca consulta o Mercado Pago diretamente;
- payload do webhook não determina status financeiro;
- divergência de `external_reference`, valor ou moeda falha fechado;
- dados pessoais de pagador não são persistidos no ledger canônico;
- receipt e evidência canônica tornam-se imutáveis após gravação.

## Limites deliberados

A v0.71 **não cria** checkout, preferência ou assinatura no Mercado Pago. `checkoutEnabled` permanece `false`. A criação externa deverá ser uma versão posterior, com política fiscal/comercial e credenciais de STAGE homologadas.

STAGE também continua bloqueado enquanto os secrets exclusivos `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` não forem configurados no repositório Academy.
