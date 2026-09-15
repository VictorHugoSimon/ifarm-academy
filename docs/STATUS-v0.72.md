# iFarm Academy — Status v0.72

## Estado
A v0.72 fecha, em código, a **criação externa de assinatura pendente no Mercado Pago** para planos individuais com preço por assinatura em BRL.

A criação permanece **fail-closed por padrão**. Nenhuma chamada ao Mercado Pago ocorre sem todos os gates abaixo:

- `ACADEMY_PAYMENT_PROVIDER=mercado_pago`;
- `ACADEMY_PAYMENT_CHECKOUT_ENABLED=true`;
- `ACADEMY_PAYMENT_RETURN_URL` HTTPS válida;
- `MERCADOPAGO_ACCESS_TOKEN` server-side;
- `MERCADOPAGO_WEBHOOK_SECRET` server-side;
- usuário autenticado pelo iFarm Core;
- checkout local aberto com snapshot comercial válido.

## Fluxo implementado
1. usuário autenticado escolhe plano individual e periodicidade;
2. `/api/checkout-sessions` cria/reusa assinatura `pending_payment` e checkout local imutável;
3. `/api/checkout-provider` obtém o e-mail exclusivamente de `GET /api/v1/me` do iFarm Core;
4. a Academy cria uma preapproval `pending` no Mercado Pago usando:
   - valor e moeda do snapshot server-side;
   - `external_reference = checkoutId`;
   - chave de idempotência estável igual ao checkout local;
   - URL de retorno controlada pela Academy;
5. a resposta do provider é validada e persistida com SHA-256;
6. o browser recebe apenas a URL HTTPS validada de checkout;
7. **nenhum entitlement é ativado nessa etapa**;
8. ativação continua dependendo do fluxo v0.70/v0.71: Webhook HMAC + consulta canônica + processador verificado.

## Segurança
- o browser não envia valor, moeda, versão de preço ou payer email ao adapter do provider;
- Access Token e Webhook Secret nunca vão para o bundle;
- apenas host HTTPS oficial do Mercado Pago é aceito como URL de checkout;
- criação no provider é idempotente;
- snapshot da requisição e resposta criada ficam imutáveis no D1;
- timeout/falha podem ser repetidos com a mesma idempotency key;
- o provider não pode ativar acesso apenas por retornar uma preapproval.

## Persistência
Migration `0045_mercadopago_checkout_creation.sql` adiciona `academy_checkout_provider_sessions` para:
- idempotência;
- estado de criação;
- número de tentativas;
- resource ID;
- URL de checkout;
- status do provider;
- hash da resposta;
- código da última falha.

## UX
A área autenticada recebe **Minha assinatura**, com:
- planos individuais elegíveis;
- periodicidade mensal/anual publicada;
- histórico de checkouts;
- indicação explícita de readiness;
- redirecionamento ao Mercado Pago apenas quando o ambiente estiver homologado.

O portal público informa disponibilidade, mas checkout continua exigindo autenticação.

## Limites deliberados
- `per_user`/plano corporativo não usa esse checkout; política de quantidade/licenciamento permanece TBD;
- somente BRL está habilitado no adapter atual;
- política de reembolso permanece TBD;
- nenhum segredo real é usado no CI;
- STAGE permanece com `ACADEMY_PAYMENT_CHECKOUT_ENABLED=false` até homologação humana.

## Próximo bloco
v0.73: fechar evidência de período de cobrança recorrente de forma auditável, sem inventar `period_end` como se tivesse vindo do provider.
