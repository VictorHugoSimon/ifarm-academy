# Motor Comercial iFarm Academy — v0.42

## Objetivo

Transformar contexto educacional em uma ponte opcional para produtos e serviços do ecossistema iFarm. O motor separa três conceitos que não podem ser confundidos:

1. **Contexto elegível** — o usuário concluiu um curso, possui certificado, está inscrito em evento ou acessa uma trilha/plano permitido.
2. **Recomendação** — uma regra ativa permite exibir uma oferta relacionada ao contexto.
3. **Oportunidade comercial** — só existe depois do opt-in explícito do usuário.

## Fluxo

`Contexto acadêmico → Regra ativa → Recomendação → Consentimento explícito → Oportunidade → Pipeline → Conversão`

A leitura de recomendações não grava oportunidade.

## Modelo

### academy_commercial_offer_rules

Configuração versionável da recomendação. Contém origem, interesse, sistema/alvo externo, texto de exibição, CTA, finalidade de tratamento, texto de consentimento e versão.

Uma regra em status `active` não pode ser alterada em conteúdo. Para modificar oferta ou consentimento:

`active → archived → nova regra/versão → active`

### academy_commercial_opportunities

Registro canônico da oportunidade consentida. Não é cadastro de pessoa e não armazena telefone/e-mail. A identidade continua referenciada por `user_id`, respeitando a futura integração com iFarm Core/Identity.

A oportunidade preserva:
- origem acadêmica;
- instância que comprovou elegibilidade quando aplicável;
- regra que originou a recomendação;
- oferta e interesse congelados;
- evidência, finalidade, texto e versão do consentimento;
- etapa comercial;
- responsável;
- referência real de conversão.

## Sistemas externos

`offer_system` identifica o dono do produto/serviço. `offer_ref` é apenas uma referência externa. A Academy não deve copiar catálogo, estoque, apólice, proposta de crédito, contrato ou cadastro CRM desses módulos.

## Compatibilidade Smart Farm

`academy_event_commercial_leads` é preservada para compatibilidade da Smart Farm Experience. A migration 0028 cria uma oportunidade canônica para cada lead histórico já existente.

Como o modelo antigo não armazenava o texto integral apresentado ao usuário, a migração não fabrica esse dado: `consent_text_snapshot` e `consent_version` permanecem nulos para registros classificados como `legacy_event_interest`.

Novos interesses Smart Farm usam consentimento server-side versionado e também entram no modelo canônico.

## APIs

- `GET /api/commercial-recommendations?sourceType=&sourceRef=` — somente leitura.
- `POST /api/commercial-opt-in` — cria oportunidade após consentimento explícito e revalidação de elegibilidade.
- `GET|POST|PUT /api/commercial-rules` — governança administrativa.
- `GET|PUT /api/commercial-opportunities` — pipeline administrativo.
- APIs `event-interest` e `event-leads` permanecem compatíveis com a experiência existente.

## Segurança

Administração exige `academy_admin` ou `ifarm_admin`. O tenant e o usuário são obtidos do boundary autenticado. `tenantId` do payload não é aceito como autoridade.

O servidor revalida a regra, janela de vigência, versão do consentimento e elegibilidade no momento do opt-in, reduzindo risco de TOCTOU ou manipulação do browser.
