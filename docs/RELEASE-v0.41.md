# iFarm Academy v0.41 — Planos & Ofertas Públicas Foundation

## Objetivo
Criar a fundação comercial para planos individuais, corporativos e parceiros sem ativar cobrança antes da homologação de identidade, Mercado Pago e regras fiscais.

## Entregas
- `academy_plans` com público, modo comercial, status, destaque e limite corporativo opcional;
- `academy_plan_prices` com versões imutáveis, mensal/anual e preço por assinatura ou usuário;
- somente uma versão ativa por plano/periodicidade;
- `academy_plan_courses` e `academy_plan_paths` para benefícios educacionais;
- `academy_plan_external_benefits` para Store, Services, Finance, Insurance, Core e parceiros apenas por referência;
- `academy_subscriptions` preparada para estados de assinatura, sem endpoint de ativação na v0.41;
- assinatura paga ativa exige provedor, ID do provedor, referência de ativação e período;
- assinatura gratuita/contratual ativa exige referência explícita de ativação, sem gateway fictício;
- APIs administrativas de planos e preços;
- API de assinaturas somente leitura;
- `/plans` e `/plans/{slug}` no portal público;
- projeção pública tenant-aware e White Label-aware;
- painel `Planos & Ofertas` no workspace;
- migrations `0026` e `0027`;
- testes unitários e fixture D1-compatible em CI.

## Regras de segurança e negócio
- nenhum preço padrão é seedado;
- preço histórico não é sobrescrito; nova condição gera nova versão;
- plano `priced` só pode ser público com preço ativo válido;
- plano `free` e `contact_sales` não aceitam preço ativo/draft;
- plano público só aceita curso academicamente publicado + perfil público e trilha pública;
- benefício externo não duplica catálogo, estoque, contrato ou elegibilidade de outro módulo iFarm;
- `external_ref` não é exposto pela API pública;
- White Label filtra cursos do plano conforme o catálogo permitido para o tenant;
- checkout e criação/ativação de assinatura permanecem bloqueados.

## Fora de escopo
- Mercado Pago real;
- checkout;
- cupom;
- cobrança recorrente;
- trial;
- split/repasse;
- entitlement automático por pagamento;
- cancelamento financeiro;
- regra fiscal/CNAE/nota fiscal;
- preços comerciais definitivos.

## Próxima frente
Checkout e assinatura só avançam depois da identidade real do iFarm Core, STAGE e configuração comercial/fiscal. Enquanto isso, as próximas frentes seguras são busca/recomendação pública, leads comerciais consentidos e preparação de infraestrutura STAGE.
