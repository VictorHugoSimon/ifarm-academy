# Status — iFarm Academy v0.63

## Entregue
- parceiros públicos como projeção editorial por `source_system + external_ref`, sem duplicar cadastro mestre;
- bundles públicos com cursos, trilhas, planos, parceiros e itens externos por referência;
- modos comerciais explícitos `free`, `priced` e `contact_sales`, sem preço padrão;
- nenhum checkout ou entitlement criado por bundle nesta versão;
- tenant resolvido pelo host público/White Label, nunca por `tenantId` do visitante;
- catálogo White Label aplicado aos cursos dentro de bundles;
- composição publicada bloqueada no banco; edição administrativa retorna o bundle a `hidden` antes de substituir itens;
- bundle sem item público elegível falha fechado no detalhe e não aparece no catálogo;
- governança administrativa de Parceiros & Bundles no `/app`;
- rotas `/partners`, `/partners/:slug`, `/bundles` e `/bundles/:slug`;
- Parceiros e Bundles integrados à busca pública unificada sem perfilamento comportamental;
- fixture D1-compatible dedicada e gate de CI.

## Segurança e governança
- `source_system/external_ref` do parceiro são identidade imutável;
- itens externos não publicam `external_ref` ao visitante;
- produtos, serviços, seguros, crédito e consultoria continuam pertencendo aos módulos responsáveis do ecossistema;
- nenhuma presença, navegação, busca ou visualização cria lead automaticamente;
- `main`, produção, iFarm Core e recursos externos não são alterados por esta release.

## Fora do escopo
- checkout/Mercado Pago;
- entitlement de bundle;
- estoque/Store;
- contrato/apólice/crédito;
- split, comissão, repasse ou conciliação;
- recomendação comportamental/personalizada.
