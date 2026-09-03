# iFarm Academy v0.35 — Marketplace Foundation

## Objetivo
Criar a primeira camada governada do marketplace de cursos parceiros sem presumir comissão, checkout, split financeiro ou política comercial ainda não aprovada.

## Entregas
- migration `0020_marketplace.sql`;
- submissão de curso por instrutor vinculado como autor/instrutor ativo;
- somente curso academicamente `published` pode ser submetido;
- workflow `submitted → under_review → changes_requested/approved/rejected → published`;
- ressubmissão após ajustes ou rejeição;
- revisão administrativa auditável;
- regra de comissão versionada por submissão;
- modos `percentage` e `fixed_amount`;
- percentual armazenado em basis points para evitar arredondamento implícito;
- soma percentual obrigatoriamente igual a 10000 basis points;
- participações explícitas de iFarm, instrutor e parceiro;
- responsabilidade pela taxa do gateway explicitamente configurável;
- vigência inicial/final e justificativa obrigatórias;
- confirmação humana explícita antes de ativar regra comercial;
- histórico preservado: regra anterior passa a `retired` ao ativar nova versão;
- publicação no marketplace bloqueada sem regra ativa e vigente;
- catálogo marketplace tenant-aware;
- permissões derivadas do identity boundary confiável;
- área `Marketplace` integrada ao workspace;
- fixture D1-compatible com autoria, tenant, comissão e unicidade da regra ativa;
- gate específico no CI;
- versão `0.35.0`.

## O que esta versão NÃO faz
- não define percentual padrão de comissão;
- não determina preço do curso;
- não executa checkout;
- não cria split de pagamento;
- não efetua repasse ao instrutor/parceiro;
- não calcula impostos, retenções ou obrigações fiscais;
- não habilita evento pago ou curso pago sem o futuro fluxo de pagamento.

O percentual comercial continua **TBD** até decisão humana. O sistema apenas garante que, quando uma regra for definida, ela seja explícita, versionada e auditável.

## Segurança e segregação
- submissões, cursos, instrutores e regras são tenant-aware;
- trigger impede submissão por instrutor sem papel ativo no curso;
- trigger impede referência cross-tenant;
- publicação comercial exige aprovação + curso publicado + regra vigente;
- administração de comissão/publicação exige `academy_admin` ou `ifarm_admin`.

## Próxima camada sugerida
White label foundation: identidade visual, escopo de catálogo e certificado por tenant, sem provisionamento automático de DNS.

## Governança
- destino: `develop`;
- nenhum deploy nesta release;
- `main` e produção permanecem intactos;
- nenhum secret, banco, token ou recurso de outro projeto é reutilizado.
