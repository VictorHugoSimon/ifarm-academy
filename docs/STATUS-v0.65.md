# iFarm Academy — Status v0.65

## Curadoria Editorial Multi-superfície
A v0.65 expande a curadoria editorial v0.64 para todas as superfícies contextuais já previstas, sem introduzir histórico comportamental, perfilamento comercial ou geração automática de lead.

### Entregas
- componente reutilizável `ContextualRecommendations`;
- curadoria contextual em detalhe de trilha;
- curadoria contextual em perfil público de instrutor;
- curadoria contextual em detalhe de plano;
- curadoria contextual em parceiro;
- curadoria contextual em bundle;
- detalhe público de evento em `/events/{id}`;
- curadoria contextual em evento;
- endpoint público de evento não expõe `meeting_url`;
- busca pública e itens editoriais de evento passam a apontar para a página de detalhe;
- gate `editorial_multisurface_contract.py` no CI;
- versão 0.65.0.

### Privacidade
A seleção continua integralmente editorial. O componente recebe somente tipo da superfície e ID do conteúdo público. Nenhuma identidade de visitante, histórico de navegação ou perfil comportamental entra na seleção.

### Banco
- nenhuma migration nova;
- permanecem 40 migrations;
- reutiliza os guards de `0040_public_editorial_recommendations.sql`.

### Segurança de evento
- somente eventos `published` do tenant resolvido por host são retornados;
- `meeting_url` nunca é retornado pelo detalhe público;
- inscrição continua exigindo autenticação;
- evento pago não cria checkout/entitlement sem camada financeira homologada.

### Infraestrutura
Sem deploy, sem novo secret e sem alteração em `main`/produção nesta release de desenvolvimento.
