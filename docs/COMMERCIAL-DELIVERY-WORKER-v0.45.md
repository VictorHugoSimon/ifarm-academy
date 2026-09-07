# iFarm Academy v0.45 — Commercial Delivery Worker Boundary

## Objetivo

Preparar a entrega segura da outbox comercial para futuros adapters do iFarm Core, CRM ou parceiros sem inventar endpoint, credencial ou transporte externo.

A v0.45 implementa o protocolo interno:

`outbox → claim exclusivo → tentativa → receipt/falha → retry ou dead-letter`

**Claim não significa entrega.** Um handoff só vira `delivered` quando um adapter autorizado devolver uma referência real de recebimento.

## O que esta versão NÃO faz

- não contém URL de CRM;
- não contém URL de iFarm Core;
- não executa `fetch()` para sistema comercial externo;
- não armazena credencial externa;
- não resolve e-mail, telefone ou outros dados pessoais;
- não marca uma mensagem como entregue sem `deliveryReference`.

## Boundary do worker

Endpoint interno:

`POST /api/commercial-handoff-worker`

Autenticação fail-closed:
- secret de serviço `ACADEMY_COMMERCIAL_WORKER_SECRET`;
- header interno `x-ifarm-commercial-worker-secret`;
- `x-ifarm-worker-id` obrigatório;
- `x-ifarm-tenant-id` obrigatório.

O secret nunca deve ser enviado ao browser.

## Ações

### `claim`

Reserva um handoff devido para um worker específico.

O processo:
1. filtra pelo tenant e destination system;
2. aceita somente `pending` devido ou `failed` com retry vencido;
3. revalida consentimento LGPD;
4. cria claim exclusivo com TTL;
5. muda o handoff para `processing`;
6. incrementa o número de tentativas;
7. registra a tentativa;
8. retorna o envelope já existente na outbox.

O envelope base continua sem `userId`, e-mail ou telefone.

### `delivered`

Exige:
- handoff em processamento;
- claim ativo pertencente ao mesmo worker/tenant;
- tentativa ativa;
- `deliveryReference` real;
- consentimento ainda permitido no instante da confirmação.

Se a autorização for revogada entre claim e confirmação, o handoff é cancelado e a tentativa registra `consent_revoked_before_delivery`.

### `failed`

Registra falha do adapter.

Por padrão a falha é retryable. Quando houver tentativas restantes, o worker agenda `next_attempt_at` usando backoff exponencial. Quando não houver, o handoff permanece `failed` sem próximo retry e entra em dead-letter.

### `recover_expired`

Recupera claims cujo TTL expirou enquanto o handoff ainda estava em `processing`.

A tentativa vira `timed_out`, o claim é liberado e o handoff recebe retry ou dead-letter conforme a política de tentativas.

## Configuração reversível

Variáveis opcionais:
- `ACADEMY_COMMERCIAL_WORKER_MAX_ATTEMPTS`: default `5`, faixa `1..20`;
- `ACADEMY_COMMERCIAL_WORKER_CLAIM_TTL_SECONDS`: default `300`, faixa `30..3600`.

Backoff padrão:
- tentativa 1: 60s;
- tentativa 2: 120s;
- tentativa 3: 240s;
- progressão exponencial com teto técnico.

Esses valores são operacionais e reversíveis; não representam SLA comercial definitivo.

## Persistência

Migration `0033_commercial_delivery_worker.sql` adiciona:

### `academy_commercial_handoff_claims`
Claim exclusivo por handoff enquanto aberto. Guarda token interno, worker, início, expiração e motivo de liberação.

### `academy_commercial_handoff_attempts`
Histórico de cada tentativa, com status `processing`, `delivered`, `failed` ou `timed_out`.

### `academy_commercial_handoff_dead_letters`
Registro imutável de handoffs que excederam a política de retry ou tiveram falha terminal.

## Proteções no banco

- dois workers não podem possuir claim aberto do mesmo handoff;
- handoff terminal sem `next_attempt_at` não pode ser reclamado;
- claim exige handoff devido no mesmo tenant;
- claim é bloqueado quando o consentimento está indisponível;
- tentativa exige claim ativo correspondente;
- receipt é obrigatório para tentativa entregue;
- falha exige código de erro;
- tentativas terminadas não podem ser reescritas;
- dead-letter exige handoff terminalmente falho e é imutável.

## Integração futura

Um adapter real deverá:
1. autenticar no boundary do worker;
2. executar `claim`;
3. interpretar `destinationSystem`, `eventType`, `payloadVersion` e `payload`;
4. resolver dados adicionais somente no sistema autorizado e somente se necessários;
5. chamar o destino aprovado;
6. responder `delivered` com receipt real ou `failed` com código normalizado.

Até que o contrato real do iFarm Core/CRM seja disponibilizado e autorizado, a Academy deve parar neste boundary e não supor formatos externos.
