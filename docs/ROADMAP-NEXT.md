# Próximas camadas — iFarm Academy

## Concluído até v0.20
- Identidade fail-closed preparada para integração com o iFarm Core.
- Isolamento tenant-aware em APIs administrativas e estudantis.
- Course Builder persistido em API/D1.
- Quiz Builder server-side com política versionada.
- Correção manual auditável.
- Workflow `draft → review → published → archived`.
- Catálogo tenant-aware e matrícula server-side.
- Student Player consumindo curso matriculado do D1.
- Progresso server-side por aula e posição de retomada.
- Avaliação estudantil server-side sem exposição do gabarito.
- Conclusão automática da matrícula.
- Certificação automática após requisitos reais de conclusão.
- Validação sequencial das migrations no CI.
- Triggers de integridade multi-tenant no banco.

## Próximas prioridades
1. Editor de conteúdo da aula para texto, links, PDFs, apresentações e materiais.
2. Persistência e renderização segura de `content_json` por tipo de conteúdo.
3. Upload de materiais com storage exclusivo da Academy.
4. Preparação do streaming de vídeo e retomada real por posição.
5. Página pública completa de validação do certificado + QR Code.
6. Testes de integração das Pages Functions com D1 isolado e fixtures reais.
7. Lockfile íntegro e migração do CI de `npm install` para `npm ci`.
8. Provisionamento exclusivo de Cloudflare Pages + D1 para STAGE.
9. Integração definitiva com sessão/RBAC do iFarm Core.
10. Mercado Pago somente após identity boundary real, webhook assinado e validações comerciais/fiscais.

## Governança
- `develop` é a linha de integração.
- `main` e produção permanecem fora das mudanças até homologação do STAGE.
- Não reutilizar secrets, bancos, tokens ou recursos de outros projetos.
- CNAE, regras fiscais e percentual de comissão do marketplace permanecem TBD.
