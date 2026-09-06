# iFarm Academy v0.38 — Notification Center Foundation

## Objetivo
Criar uma central de notificações in-app da Academy sem duplicar prematuramente o barramento corporativo do iFarm Core e sem ativar canais externos antes de infraestrutura homologada.

## Entregas
- migration `0023_notifications.sql`;
- inbox tenant-aware por usuário;
- categorias acadêmica, compliance, eventos, comercial e sistema;
- prioridades normal, importante e urgente;
- estados não lida, lida e arquivada;
- deduplicação/idempotência por evento;
- expiração opcional;
- action path restrito a rota relativa segura da própria aplicação;
- preferências in-app por categoria;
- notificações obrigatórias podem ignorar preferência in-app quando necessárias à operação;
- e-mail e push estruturalmente bloqueados nesta versão;
- interface de leitura, filtros, arquivamento e preferências;
- geração fail-open de notificações após conclusão de curso e emissão de certificado;
- contrato `NotificationBridge` preparado para futuro barramento do iFarm Core;
- testes unitários e fixture D1-compatible;
- gate específico no CI.

## Segurança e governança
- A notificação nunca bloqueia progresso, conclusão ou certificado.
- `action_path` não aceita URL absoluta ou protocol-relative.
- Identidade tenant/usuário da notificação é imutável.
- Estado `read` exige `read_at`; estado `archived` exige `archived_at`.
- E-mail e push permanecem com valor zero protegido também por triggers do banco.
- WhatsApp não faz parte desta release.
- Não existe disparo externo sem integração homologada e autorização adequada.

## Eventos conectados inicialmente
- conclusão de curso;
- emissão de certificado.

## Próximas expansões
Eventos, renovações, compliance e comunicações comerciais poderão alimentar a mesma central. Canais externos devem ser adaptados ao serviço oficial do iFarm Core quando sua arquitetura estiver inspecionada.

## Infraestrutura
Nenhum deploy, secret, provedor de e-mail, push ou WhatsApp foi criado. Destino exclusivo: `develop`.
