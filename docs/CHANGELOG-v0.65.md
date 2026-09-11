# Changelog v0.65

## Added
- curadoria contextual em trilhas, instrutores, eventos, planos, parceiros e bundles;
- página pública de detalhe de evento;
- componente reutilizável de carregamento de recomendações contextuais;
- gate CI específico para integração multi-superfície.

## Changed
- links editoriais de eventos apontam para `/events/{id}`;
- busca pública de eventos aponta para o detalhe público.

## Security & Privacy
- detalhe público de evento não retorna `meeting_url`;
- recomendação continua sem identidade do visitante, histórico comportamental, perfilamento comercial ou lead automático;
- tenant continua resolvido por host/White Label.

## Unchanged
- streaming, checkout, subscriptions, split/repasses e barramento oficial de notificações continuam dependentes das respectivas decisões/integrações externas.
