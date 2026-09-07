# Handoff Comercial iFarm Academy — v0.43

## Objetivo

Criar um boundary de integração entre a Academy e sistemas comerciais externos sem acoplar o domínio acadêmico a um CRM, Store, Finance, Insurance ou iFarm Core ainda não inspecionado.

## Arquitetura

`Academy Opportunity → Handoff Outbox → Adapter futuro → Sistema destino → Ack/Reference`

A Academy encerra sua responsabilidade síncrona ao gravar a intenção na outbox. Nenhuma rota da v0.43 faz requisição HTTP para CRM/iFarm Core.

## Outbox

Tabela: `academy_commercial_handoff_outbox`.

Um handoff contém:
- oportunidade canônica;
- destino lógico;
- tipo/versionamento de evento;
- payload comercial congelado;
- estado operacional;
- tentativas e próxima tentativa;
- referência de entrega quando confirmada;
- código de erro em falha;
- ator e timestamps.

### Payload mínimo

O helper `buildCommercialHandoffPayload` envia somente contexto necessário para correlação comercial:
- opportunityId;
- origem acadêmica e referência;
- interesse;
- referência da oferta;
- evidência/versão/timestamp do consentimento;
- etapa e referência de conversão quando existente.

Ele deliberadamente não inclui `userId`, e-mail, telefone ou dados de contato. O sistema destino deve resolver identidade por contrato apropriado quando a integração real existir, evitando replicação desnecessária de PII na outbox.

## Estados

- `pending`: aguardando adapter;
- `processing`: tentativa iniciada;
- `failed`: tentativa falhou e exige código de erro;
- `delivered`: destino confirmou e forneceu referência;
- `cancelled`: encerrado sem entrega.

`delivered` e `cancelled` são terminais. Payload, oportunidade, destino e versão são imutáveis após criação.

## Idempotência

Existe somente um handoff aberto para a mesma oportunidade + destino + tipo de evento. A futura integração deve reutilizar `handoff.id` como parte da chave de idempotência externa.

## Evidência de conversão

Tabela: `academy_commercial_conversion_evidence`.

A evidência só pode ser anexada a oportunidade já convertida e com `conversion_ref`. É append-only e referencia um fato verificável, por exemplo pedido, contrato, CRM, pagamento ou parceiro.

O valor atribuído é opcional. Quando informado, moeda e centavos são preservados. Relatórios agrupam por moeda; BRL e USD nunca são somados em um único total.

## Métricas

`GET /api/commercial-metrics` fornece:
- funil por coorte de oportunidades;
- taxa de conversão da coorte;
- conversões confirmadas no período;
- saúde da outbox;
- valores comerciais atribuídos segregados por moeda;
- cortes por origem, sistema de oferta e sistema de evidência.

Essas métricas são operacionais/comerciais. Não substituem financeiro, fiscal ou contabilidade.

## Adapter futuro

O adapter real deve ser implementado somente após inspeção do contrato de destino e deverá contemplar:
1. autenticação de serviço e segredo fora do repositório;
2. idempotency key;
3. timeout, retry e backoff;
4. classificação segura de erros;
5. confirmação explícita com `delivery_reference`;
6. auditoria e observabilidade;
7. segregação por tenant;
8. política de dados pessoais e LGPD;
9. dead-letter/reprocessamento controlado;
10. testes STAGE antes de qualquer produção.
