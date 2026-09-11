# iFarm Academy — Status v0.64

## Curadoria Editorial do Portal
A v0.64 adiciona recomendações editoriais/contextuais tenant-aware ao portal público sem histórico comportamental, perfilamento comercial ou geração automática de lead.

### Entregas
- migration `0040_public_editorial_recommendations.sql`;
- blocos editoriais por superfície: home, curso, trilha, instrutor, evento, plano, parceiro e bundle;
- contexto explícito e imutável por bloco;
- prioridade, ordenação, janela opcional de validade, selo e justificativa editorial;
- composição publicada travada no banco;
- publicação bloqueada para itens/contextos não públicos ou cross-tenant;
- filtro White Label aplicado novamente na leitura pública;
- endpoint administrativo + catálogo de referências públicas;
- endpoint público `/api/public/recommendations` resolvido por host/tenant;
- contrato público declara `behavioralPersonalization:false`, `commercialProfiling:false`, `visitorHistoryUsed:false` e `automaticLeadGeneration:false`;
- painel `Curadoria do Portal` no workspace administrativo;
- rails editoriais na Home e no detalhe de curso;
- fixture D1-compatible específica e gate de CI.

### Segurança e LGPD
O modelo não possui `user_id`, `student_id`, `visitor_id`, sessão, histórico de navegação, perfil comportamental, lead ou oportunidade. A seleção é editorial e determinística.

### Não entregue nesta versão
- recomendação baseada em histórico individual;
- scoring comportamental;
- personalização comercial automática;
- criação automática de lead;
- provider externo de recomendação.

### Infraestrutura
- `develop` continua linha de integração;
- `main` e produção não são alterados por esta release;
- nenhuma credencial nova é necessária.
