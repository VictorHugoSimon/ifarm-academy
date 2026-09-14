# iFarm Academy — Status v0.66

## SEO técnico e descoberta pública
A v0.66 adiciona indexação pública controlada por tenant/host, sem expor áreas autenticadas, utilitários sensíveis ou conteúdo fora do catálogo White Label.

### Entregas
- `sitemap.xml` dinâmico por host/tenant;
- `robots.txt` dinâmico por ambiente;
- STAGE e ambientes não produtivos com `Disallow: /`;
- sitemap apenas com conteúdo público e permitido pelo White Label;
- exclusão explícita de `/app`, `/api`, `/search`, validação de certificado e check-in do índice;
- canonical, description, Open Graph e Twitter Card no bootstrap público;
- helper seguro de serialização XML;
- teste unitário de sitemap/robots;
- fixture D1-compatible específica e gate CI.

### Segurança
- host precisa resolver um tenant público válido;
- nenhum tenant é recebido por query/body do visitante;
- nenhuma rota privada entra no sitemap;
- canonical não pode apontar para origem externa arbitrária;
- ambiente não produtivo não é indexável.

### Infraestrutura
- nenhuma migration nova;
- nenhuma credencial nova;
- nenhum deploy nesta release;
- `main` e produção permanecem intactos.
