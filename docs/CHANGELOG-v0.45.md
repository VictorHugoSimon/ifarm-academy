# Changelog — v0.45.0

## Added

- worker boundary comercial interno;
- autenticação específica de serviço;
- claims exclusivos com TTL;
- tentativas versionadas por número;
- retry/backoff;
- recuperação de claim expirado;
- dead-letter;
- receipt obrigatório para entrega;
- fixture de integração do worker;
- testes unitários de configuração/autenticação/retry.

## Changed

- CI passa a validar 33 migrations e o contrato do delivery worker;
- Env da Academy reconhece configurações do worker;
- entrega comercial agora possui protocolo formal de claim/report, ainda desacoplado do transporte.

## Security / LGPD

- claim revalida consentimento;
- banco bloqueia claim quando contato está suprimido/revogado;
- confirmação de entrega revalida consentimento imediatamente antes do receipt;
- payload base continua sem PII de contato;
- worker secret não pertence ao browser.

## Intencionalmente fora do escopo

- deploy;
- CRM/iFarm Core real;
- endpoint externo inventado;
- credentials/tokens de destino;
- sincronização de e-mail/telefone;
- scheduler/cron de produção.
