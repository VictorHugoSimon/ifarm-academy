# STATUS — iFarm Academy v0.62

## Escopo
Busca & Descoberta Pública unificada para cursos, trilhas, instrutores, eventos e planos já publicados no portal do tenant.

## Entregue
- endpoint público `GET /api/public/search`;
- página pública `/search`;
- busca por texto normalizado em português, incluindo acentos;
- filtros por tipo, categoria, acesso, nível e modalidade;
- facets com contagem por dimensão;
- paginação com limites server-side;
- ranking determinístico por correspondência textual e destaque editorial;
- integração da busca da home com a busca unificada;
- catálogo `/courses` preserva filtro exclusivo de cursos;
- resolução de tenant exclusivamente pelo host público/White Label já verificado;
- cursos continuam respeitando `academy_white_label_catalog_courses`;
- trilhas só aparecem se tiverem curso público permitido no catálogo do tenant;
- instrutores usam somente a projeção pública aprovada;
- eventos retornam somente eventos futuros/publicados e não expõem link privado;
- planos retornam somente planos públicos;
- teste unitário do motor de ranking/filtros;
- fixture SQLite/D1-compatible dedicada no CI;
- versão `0.62.0`.

## Privacidade e segurança
- nenhuma autenticação é exigida para busca pública;
- nenhum `tenantId` do visitante é aceito como autoridade;
- nenhum histórico de navegação é consultado;
- nenhum perfil comportamental é persistido;
- nenhum lead ou oportunidade comercial é criado pela busca;
- `behavioralPersonalization=false` e `commercialProfiling=false` fazem parte do contrato da resposta;
- filtros e paginação possuem limites server-side.

## Schema
Sem migration nova. Permanecem 37 migrations versionadas.

## Próximos blocos
Portal avançado pode evoluir com parceiros/bundles e recomendações contextuais/consentidas. Streaming, checkout, subscriptions e marketplace financeiro continuam dependentes de decisões ou infraestrutura externa.
