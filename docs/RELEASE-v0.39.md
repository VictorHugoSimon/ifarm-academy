# iFarm Academy v0.39 — Portal Público Foundation

## Objetivo
Entregar a primeira superfície comercial pública da iFarm Academy, separando navegação pública da operação autenticada e respeitando multi-tenant/White Label sem expor dados internos.

## Entregas
- `/` como home pública;
- `/courses` como catálogo público;
- `/courses/{slug}` como detalhe público do curso;
- `/events` como agenda pública;
- `/app` como workspace autenticado/operacional;
- preservação de `/certificates/validate` e `/smart-farm/checkin`;
- resolução do tenant exclusivamente pelo hostname;
- domínio White Label somente quando previamente verificado;
- host padrão resolvido apenas por `ACADEMY_PUBLIC_DEFAULT_HOST` + `ACADEMY_PUBLIC_DEFAULT_TENANT_ID`;
- nenhum `tenantId` aceito do visitante;
- metadados públicos de curso separados do núcleo acadêmico;
- slug único por tenant;
- categoria, nível, público-alvo, capa, destaque, SEO e modelo de acesso;
- preço opcional em centavos, sem ativar cobrança;
- suporte de apresentação para gratuito, patrocinado, incluído e pago;
- checkout bloqueado enquanto integração de pagamento não estiver homologada;
- eventos públicos sem exposição do link privado de reunião;
- catálogo respeitando escopo White Label;
- painel administrativo `Portal Público` para governança de visibilidade/metadados;
- migration `0024_public_portal.sql`;
- testes de boundary público e fixture D1-compatible;
- gate específico no CI.

## Segurança e isolamento
- o visitante nunca escolhe tenant por query/body/header;
- hostname desconhecido não resolve tenant;
- hostname White Label só resolve quando `status='verified'`;
- conteúdo de aula, materiais protegidos, gabaritos, links privados e meeting URLs não fazem parte do contrato público;
- publicação acadêmica não implica publicação comercial automática;
- `main` e produção permanecem intocados.

## Limites desta release
- sem login/cadastro público novo; a identidade definitiva virá do iFarm Core;
- sem carrinho/checkout real;
- sem Mercado Pago;
- sem split/repasse;
- sem DNS automático;
- sem deploy STAGE/PROD.

## Próximo passo recomendado
Homologar o portal em STAGE com host exclusivo da Academy, D1 próprio e identity boundary do iFarm Core. Em paralelo, continuar as frentes funcionais que não dependem de infraestrutura externa.
