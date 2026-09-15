# PR v0.67 — Performance & Acessibilidade Foundation

## Objetivo
Reduzir o bundle inicial e melhorar navegação por teclado/movimento reduzido sem alterar regras de negócio.

## Escopo
- route-level code-splitting com `React.lazy`/`Suspense`;
- fallback acessível;
- skip-to-content;
- foco visível;
- `prefers-reduced-motion`;
- CSS de sessão carregado no chunk autenticado;
- contrato CI dedicado;
- versão 0.67.0.

## Fora do escopo
Reescrita visual, mudança de layout master, SSR, CDN externa, analytics e alterações de regra acadêmica/comercial.

## Gate
Merge somente com CI integralmente verde.
