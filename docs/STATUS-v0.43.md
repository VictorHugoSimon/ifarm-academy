# iFarm Academy — Status v0.43

## Escopo

A v0.43 adiciona handoff comercial desacoplado e métricas de conversão ao Motor Comercial da Academy, sem criar integração fictícia com CRM/iFarm Core e sem tratar valor atribuído como receita contábil.

## Entregue

- outbox multi-tenant para handoffs comerciais;
- destino lógico `ifarm_core`, `crm`, `partner` ou `other`;
- payload versionado e imutável;
- payload sem `userId`, e-mail, telefone ou dados de contato;
- estados `pending`, `processing`, `delivered`, `failed`, `cancelled`;
- referência externa obrigatória para confirmar entrega;
- código de erro obrigatório para falha;
- idempotência para handoff aberto por oportunidade/destino/evento;
- evidência imutável e append-only de conversão;
- valor comercial atribuído opcional e separado por moeda;
- métricas de funil, handoff e atribuição comercial;
- painel do Motor Comercial com preparação de handoff, evidência e KPIs;
- fixture de integração cobrindo invariantes e tenant isolation;
- migration 0031;
- versão 0.43.0.

## Regra de integração

`Preparar handoff` cria somente uma mensagem `pending` na outbox local. Não chama API externa e não significa que iFarm Core/CRM recebeu o registro.

O estado `delivered` requer `delivery_reference` e deve ser confirmado apenas quando um adapter real possuir contrato de integração e confirmação do sistema de destino.

## Regra financeira

`attributed_value_cents` representa somente valor comercial atribuído a uma conversão com evidência referenciada. Ele não representa automaticamente:

- faturamento;
- receita reconhecida;
- pagamento recebido;
- nota fiscal;
- caixa;
- contabilização oficial.

Os relatórios segregam valores por moeda e não somam moedas diferentes.

## Fora da versão

- adapter real para iFarm Core/CRM;
- credenciais externas;
- retry worker automático;
- webhook de confirmação externo;
- sincronização de contatos;
- faturamento/ERP/fiscal;
- deploy STAGE/PRODUCTION.

## Próximo passo técnico

Quando o contrato real do iFarm Core/CRM estiver disponível, implementar um adapter de outbox com autenticação de serviço, idempotency key, retry/backoff, dead-letter operacional e confirmação de entrega. Até lá, a outbox permanece um boundary seguro e desacoplado.
