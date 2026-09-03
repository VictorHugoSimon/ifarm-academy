# iFarm Academy v0.33 — Hardening Operacional

## Objetivo
Preparar a Academy para homologação em STAGE com diagnóstico rastreável, health/readiness, rate limiting e runbook de recuperação, sem fingir observabilidade externa ou backup que ainda não foram provisionados.

## Entregas
- migration `0018_operational_hardening.sql`;
- middleware global de correlation ID;
- `x-request-id` em todas as respostas;
- logs JSON estruturados com método, pathname, status, duração, ambiente e release;
- exclusão deliberada de body, query string, secrets e PII dos logs estruturados;
- liveness `/api/health`;
- readiness `/api/readiness` para D1, identity boundary e storage obrigatório;
- rate limiting D1 por bucket fixo;
- identidade transformada por SHA-256 antes da persistência do bucket;
- limites configuráveis por ambiente;
- falha do rate limiter em modo fail-open, sem alterar o fail-closed do identity boundary;
- eventos operacionais persistidos apenas para condições relevantes;
- endpoint administrativo `/api/operations-status`;
- nova área `Operações` no workspace;
- fixture D1-compatible para buckets e eventos;
- gate próprio no CI;
- runbook de incidente, observabilidade e preparação de backup/restore.

## Defaults de rate limiting
- público: 60 requisições/minuto;
- leitura autenticada: 180 requisições/minuto;
- escrita: 60 requisições/minuto.

Os valores são defaults técnicos reversíveis e podem ser sobrescritos por ambiente.

## Segurança e privacidade
- o middleware não registra corpo de requisição;
- não registra proxy secret;
- não registra e-mail, nome, CPF/documentos, respostas de avaliação ou user ID em claro;
- o identificador usado no rate limiter é reduzido a hash SHA-256;
- `/api/operations-status` exige papel global `ifarm_admin`, pois consolida saúde da plataforma inteira e não apenas de um tenant.

## Backup/restore
Esta release não declara backup real concluído. O runbook prepara a operação, mas mecanismo oficial, frequência, retenção, RPO e RTO só serão definidos e homologados após o D1 exclusivo de STAGE existir.

## Governança
- versão `0.33.0`;
- destino apenas `develop`;
- nenhum deploy nesta release;
- `main` e produção permanecem intactos;
- nenhum recurso ou secret de outro projeto é reutilizado.
