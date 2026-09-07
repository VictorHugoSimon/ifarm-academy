# Status — iFarm Academy v0.44

## Versão

`0.44.0`

## Tema

Revogação LGPD, supressão global e bloqueio comercial fail-closed.

## Entregas

- migration `0032_commercial_consent_governance.sql`;
- eventos append-only de preferência global;
- eventos append-only de consentimento por oportunidade;
- sequência monotônica para ordenar eventos;
- self-service `GET/POST /api/commercial-privacy`;
- API administrativa `POST /api/commercial-privacy-admin`;
- bloqueio de novo opt-in quando contato global está suprimido;
- bloqueio de novo interesse Smart Farm quando contato global está suprimido;
- bloqueio de handoff por revogação/supressão;
- cancelamento de handoffs ainda não entregues;
- reautorização versionada de regra comercial;
- reautorização de interesse explícito Smart Farm;
- recomendações exibem estado efetivo de consentimento;
- tela `Privacidade comercial` no workspace;
- testes unitários de resolução de estado;
- fixture SQLite de governança comercial;
- novo gate no CI.

## Segurança

- identidade/tenant vêm do trusted boundary;
- navegador não informa autoridade de tenant/usuário;
- eventos de consentimento são imutáveis;
- histórico de consentimento original não é sobrescrito;
- suppress/revoke bloqueiam handoff no API e no banco;
- regrant não é permitido durante bloqueio global;
- regrant exige versão explícita verificável;
- isolamento entre tenants testado.

## O que não foi feito

- nenhum deploy STAGE/PROD;
- nenhum segredo ou credencial;
- nenhum CRM externo;
- nenhum adapter iFarm Core;
- nenhuma sincronização de dados pessoais para sistemas externos;
- nenhuma exclusão física de histórico comercial;
- nenhuma definição jurídica/fiscal além da governança técnica.

## Próximo bloco sugerido

v0.45 — Adapter Contract & Delivery Worker:
- contrato assinado/versionado para destino iFarm Core/CRM;
- dispatcher de outbox idempotente;
- rechecagem de consentimento imediatamente antes do envio;
- retry/backoff/dead-letter;
- delivery receipt;
- sem PII no payload base;
- PII resolvido no sistema autorizado apenas quando necessário.

A implementação do adapter real continua bloqueada até existir contrato técnico e autorização do destino.
