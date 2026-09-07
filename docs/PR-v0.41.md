# PR v0.41 — Planos & Ofertas Públicas Foundation

## Escopo
- Planos individual, corporativo e parceiro.
- Modos `free`, `priced` e `contact_sales`.
- Preços mensal/anual versionados e imutáveis, por assinatura ou usuário.
- Cursos, trilhas e benefícios externos por referência.
- Subscription model preparado, escrita desabilitada.
- Portal `/plans` e `/plans/{slug}` tenant-aware/White Label-aware.
- Governança administrativa no workspace.
- Migrations 0026/0027, testes e fixture CI.

## Segurança
- sem preços default;
- sem checkout;
- sem endpoint de ativação de assinatura;
- assinatura paga ativa exige provedor confirmado;
- benefício externo não replica catálogo nem expõe external_ref publicamente;
- plano público só referencia conteúdo publicamente elegível.

Destino: `develop`. `main` e produção permanecem intactos.
