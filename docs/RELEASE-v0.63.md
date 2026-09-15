# Release v0.63 — Parceiros & Bundles Públicos

A v0.63 amplia o portal comercial da iFarm Academy sem transformar a Academy em cadastro mestre de parceiros, Store, CRM, financeiro ou seguradora.

## Parceiros
Cada parceiro público é uma projeção tenant-aware com nome, descrição, tipo, logo/site e uma referência imutável ao sistema responsável. A publicação é opt-in e auditada.

## Bundles
Bundles podem combinar cursos, trilhas, planos e referências externas a produtos/serviços do ecossistema. Cursos respeitam publicação acadêmica, perfil público e catálogo White Label. Bundle publicado exige conteúdo elegível e sua composição fica bloqueada até voltar formalmente a `hidden`.

## Portal e busca
As novas superfícies públicas são `/partners` e `/bundles`, com páginas de detalhe. Parceiros e Bundles entram também na busca unificada v0.62 mantendo ranking textual + destaque editorial, sem histórico do visitante, sem perfilamento comercial e sem geração automática de lead.

## Limites comerciais
`priced` apenas publica valor informativo configurado. `checkoutReady` permanece `false`. Pagamento, assinatura, entitlement, split, estoque, contrato, seguro e crédito continuam bloqueados até os respectivos módulos e decisões humanas serem homologados.

## Banco e CI
A release adiciona as migrations `0038_public_partners_bundles.sql` e `0039_public_bundle_composition_guards.sql`, além de fixture D1-compatible específica e gate obrigatório no CI.
