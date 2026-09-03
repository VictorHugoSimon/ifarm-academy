# Runbook Operacional — iFarm Academy

## Objetivo
Padronizar diagnóstico, resposta a incidente e preparação de recuperação sem assumir infraestrutura que ainda não foi provisionada.

## Endpoints
- `/api/health`: liveness. Deve responder mesmo quando dependências externas estiverem indisponíveis.
- `/api/readiness`: readiness. Só retorna `ready` quando D1, identity boundary e storage obrigatório estiverem disponíveis.
- `/api/operations-status`: visão administrativa dos eventos operacionais das últimas 24 horas e estado do rate limiting.

## Correlation ID
Toda resposta passa a receber `x-request-id`. Quando o cliente envia um identificador seguro, ele é preservado; caso contrário, a Academy gera um UUID. O ID deve ser usado para correlacionar erro reportado pelo usuário com logs e eventos operacionais.

## Logging
O middleware registra JSON estruturado com:
- timestamp;
- serviço;
- request ID;
- método;
- pathname sem query string;
- escopo da rota;
- status HTTP;
- duração;
- ambiente e release.

Não registrar corpo da requisição, proxy secret, e-mail, nome do usuário, documentos, respostas de prova ou identificadores pessoais.

## Rate limiting
A Academy utiliza bucket persistente por identidade/escopo. O identificador é transformado por SHA-256 antes de persistir. Defaults de desenvolvimento:
- público: 60 requisições/minuto;
- autenticado/read: 180 requisições/minuto;
- write: 60 requisições/minuto.

Os limites são configuráveis por ambiente. Falha do mecanismo de rate limiting é `fail-open` e gera log estruturado; falha do identity boundary continua `fail-closed` nos endpoints protegidos.

## Readiness
Readiness reprova quando:
- `ACADEMY_DB` não está configurado ou não responde;
- `ACADEMY_ADMIN_PROXY_SECRET` não está configurado;
- storage está marcado como obrigatório e o binding não existe.

## Incidente
1. Registrar horário, ambiente, release e request ID.
2. Consultar `/api/health`.
3. Consultar `/api/readiness`.
4. Consultar `/api/operations-status` com identidade administrativa confiável.
5. Determinar se a falha é aplicação, D1, storage, identidade ou abuso/rate limit.
6. Não alterar `main` nem produção diretamente.
7. Correção deve passar por branch, CI, STAGE e aceite antes de promoção.

## Backup e restore
Backup real depende do provisionamento exclusivo do D1/STAGE/PROD e da política escolhida no Cloudflare. Até lá:
- migrations são versionadas e testadas em sequência;
- fixtures validam integridade estrutural;
- nenhum comando de restore deve ser executado sem snapshot/export confirmado;
- PROD nunca deve ser usado para testar restore.

Quando STAGE existir, documentar e homologar:
- mecanismo oficial de backup/export do D1 vigente;
- frequência;
- retenção;
- criptografia e acesso;
- restore em banco isolado;
- validação pós-restore;
- RPO e RTO aprovados.

RPO e RTO permanecem **TBD** até decisão humana de negócio e infraestrutura.

## Alertas
Integrações externas de alerta permanecem bloqueadas até STAGE. O código já produz health/readiness, request ID e eventos estruturados que poderão alimentar o provedor escolhido sem refatorar o domínio.
