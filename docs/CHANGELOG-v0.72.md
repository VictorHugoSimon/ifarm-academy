# Changelog v0.72

## Added
- adapter server-side para criação de assinatura pendente Mercado Pago;
- feature flag `ACADEMY_PAYMENT_CHECKOUT_ENABLED`;
- `ACADEMY_PAYMENT_RETURN_URL` validada server-side;
- obtenção de payer email pelo iFarm Core autenticado;
- idempotência estável por checkout;
- migration `0045_mercadopago_checkout_creation.sql`;
- `/api/checkout-provider`;
- área **Minha assinatura**;
- fixture de persistência do checkout provider;
- testes do adapter Mercado Pago.

## Changed
- readiness de pagamento passa a diferenciar checkout externo de webhook/verificação canônica;
- portal público informa quando um plano individual está apto a iniciar checkout após login;
- STAGE example mantém checkout desligado até homologação.

## Security
- valor/moeda/e-mail não são aceitos como autoridade vindos do browser;
- secrets permanecem server-side;
- resposta do provider é correlacionada ao snapshot local antes de persistir a URL;
- criação da preapproval nunca ativa entitlement.
