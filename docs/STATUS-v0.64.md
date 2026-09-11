# Status — iFarm Academy v0.64

## Entregue
- recomendações públicas contextuais reutilizando a busca unificada homologada;
- contexto baseado apenas na página atual: categoria, título ou parceiro explicitamente visível;
- remoção do próprio recurso e deduplicação por `type + id`;
- limite determinístico de resultados;
- seção contextual em detalhes de curso, bundle e parceiro;
- suporte a cursos, trilhas, planos, parceiros e bundles como destinos relacionados;
- teste unitário do filtro e deduplicação;
- nenhuma migration nova.

## Privacidade
- não consulta userId, matrícula, progresso, histórico de busca, cookies, cliques anteriores ou perfil comercial;
- não persiste evento de navegação;
- não cria lead nem oportunidade;
- não altera o ranking público: usa ranking textual + destaque editorial já existente;
- o texto da interface deixa explícito que a seleção é contextual, não personalizada por comportamento.

## Fora do escopo
- recomendações baseadas em histórico;
- profiling comercial;
- geração automática de leads;
- recomendação paga/patrocinada sem rotulagem e governança;
- checkout/entitlement.
