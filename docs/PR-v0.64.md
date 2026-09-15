# PR v0.64 — Curadoria Editorial do Portal

## Objetivo
Adicionar blocos de recomendação editoriais/contextuais tenant-aware ao portal sem histórico comportamental, perfilamento comercial ou geração automática de lead.

## Escopo
- migration 0040;
- governança admin de blocos, prioridade, janela e composição;
- referências a curso, trilha, instrutor, evento, plano, parceiro e bundle;
- validação de tenant e publicabilidade no banco/API;
- filtro White Label na leitura;
- endpoint público com policy explícita de não personalização comportamental;
- rails na Home e no detalhe de curso;
- fixture e gate CI;
- versão 0.64.0.

## Fora do escopo
Streaming, checkout, entitlements de pagamento, split financeiro, barramento Core e perfilamento comportamental.

## Gate
Merge somente com CI integralmente verde.
