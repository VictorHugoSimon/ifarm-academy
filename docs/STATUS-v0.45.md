# Status — iFarm Academy v0.45

## Versão

`0.45.0`

## Tema

Boundary interno do worker de entrega comercial.

## Entregas

- migration `0033_commercial_delivery_worker.sql`;
- claims exclusivos e com TTL;
- histórico de tentativas;
- dead-letter imutável;
- autenticação específica de serviço, fail-closed;
- tenant obrigatório no worker;
- ação `claim` idempotente/concorrrency-safe;
- ação `delivered` com receipt obrigatório;
- ação `failed` com retry/backoff configurável;
- ação `recover_expired` para claims abandonados;
- rechecagem de consentimento no claim;
- rechecagem de consentimento imediatamente antes da confirmação de entrega;
- cancelamento seguro se a autorização for revogada durante o processamento;
- fixture SQLite dedicada;
- testes unitários de autenticação/config/retry;
- gate adicional no CI;
- versão `0.45.0`.

## Segurança

- `ACADEMY_COMMERCIAL_WORKER_SECRET` é secret interno e nunca vai para o navegador;
- workerId e tenant são obrigatórios;
- payload da outbox permanece sem PII de contato;
- claim e tentativa são tenant-scoped;
- consentimento é validado no API e no banco;
- entrega exige referência real do sistema destinatário;
- falha terminal não é reclamada automaticamente;
- dead-letter preserva rastreabilidade.

## Integração externa

Não implementada nesta versão.

Não há:
- endpoint inventado de CRM/iFarm Core;
- credencial real;
- HTTP transport para sistema comercial externo;
- criação de contato/lead fora da Academy;
- deploy.

O adapter concreto continua dependente do contrato real do iFarm Core/CRM e de autorização humana para o destino.

## Configuração

- `ACADEMY_COMMERCIAL_WORKER_MAX_ATTEMPTS`: default 5;
- `ACADEMY_COMMERCIAL_WORKER_CLAIM_TTL_SECONDS`: default 300 segundos.

São defaults operacionais reversíveis, não SLAs definitivos.

## Próximo bloco possível

v0.46 — STAGE Readiness & Integration Contract:
- manifesto dos bindings/secrets Academy;
- runbook de migrations D1;
- health/readiness específico do worker;
- contrato de adapter independente de fornecedor;
- checklist de observabilidade e rollback;
- nenhuma chamada real até o destino ser validado.
