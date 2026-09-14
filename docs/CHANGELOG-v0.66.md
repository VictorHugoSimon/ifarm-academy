# Changelog v0.66

## Added
- sitemap XML dinâmico por tenant/host;
- robots dinâmico por ambiente;
- canonical, description e metadados sociais no portal;
- teste unitário do contrato SEO;
- fixture de integração do sitemap/White Label;
- gate dedicado no CI.

## Security
- STAGE e ambientes não produtivos bloqueiam indexação;
- sitemap não inclui rotas privadas;
- tenant público é resolvido somente pelo host verificado/configurado;
- catálogo White Label é aplicado na descoberta indexável.

## Unchanged
- nenhuma migration nova;
- sem checkout, streaming ou integrações financeiras novas;
- `main` e produção não são alterados por esta release.
