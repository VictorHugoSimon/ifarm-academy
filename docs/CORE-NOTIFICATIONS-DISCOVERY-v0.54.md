# iFarm Core Notifications — descoberta v0.54

## Estado observado

A inspeção read-only do `ifarm-core-platform` em `develop` confirmou que o Core possui as capabilities `notification.read` e `notification.manage` na matriz RBAC. Porém, no código atual inspecionado, não existe rota, serviço, outbox ou barramento de notificações implementado para consumo pela Academy.

## Decisão

A Academy mantém sua inbox interna existente e não cria um adapter fictício para um serviço Core inexistente. E-mail, push, WhatsApp e distribuição externa permanecem desacoplados até existir um contrato implementado e homologado no Core.

## Regra de integração

- capability declarada não será tratada como serviço disponível;
- nenhuma URL ou credencial de notificação será inventada;
- quando o Core expuser o serviço, a Academy deverá integrar por adapter, preservando a inbox existente como projeção da experiência acadêmica;
- mudanças no Core continuam fora desta entrega.
