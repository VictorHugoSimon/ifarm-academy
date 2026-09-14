# PR v0.66 — SEO Técnico & Descoberta Pública

## Objetivo
Permitir descoberta orgânica controlada do portal público por tenant/White Label sem indexar áreas privadas, utilitários ou ambientes não produtivos.

## Escopo
- `/sitemap.xml` dinâmico;
- `/robots.txt` dinâmico;
- canonical e metadados sociais;
- bloqueio de indexação em STAGE;
- filtro White Label no sitemap;
- testes e fixture de integração;
- versão 0.66.0.

## Fora do escopo
Search Console, envio manual de sitemap, campanhas, analytics, checkout, streaming e qualquer credencial externa.

## Gate
Merge somente com CI integralmente verde.
