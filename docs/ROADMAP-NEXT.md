# Próximas camadas — iFarm Academy

## Concluído até v0.21
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
- Conclusão automática da matrícula e certificação após requisitos reais.
- Validação sequencial das migrations no CI.
- Triggers de integridade multi-tenant no banco.
- Editor de conteúdo da aula integrado ao Course Builder.
- Persistência e renderização segura de `content_json` por tipo de conteúdo.
- Conteúdo suportado: texto, link, PDF, apresentação, arquivo, vídeo, áudio, exercício, atividade prática, estudo de caso, simulação, quiz e prova.
- Validação de conteúdo mínimo antes da publicação do curso.
- URLs externas restritas a HTTP/HTTPS.
- Quiz/prova vinculados à aula usando o motor de avaliação server-side.

## Próximas prioridades
1. Upload de materiais com storage exclusivo da Academy.
2. Preparação do streaming de vídeo e retomada real por posição.
3. Página pública completa de validação do certificado + QR Code.
4. Testes de integração das Pages Functions com D1 isolado e fixtures reais.
5. Lockfile íntegro e migração do CI de `npm install` para `npm ci`.
6. Provisionamento exclusivo de Cloudflare Pages + D1 para STAGE.
7. Integração definitiva com sessão/RBAC do iFarm Core.
8. Painel empresarial com atribuição de cursos e trilhas obrigatórias.
9. Eventos/Smart Farm Experience conectados a inscrições e presença.
10. Mercado Pago somente após identity boundary real, webhook assinado e validações comerciais/fiscais.

## Governança
- `develop` é a linha de integração.
- `main` e produção permanecem fora das mudanças até homologação do STAGE.
- Não reutilizar secrets, bancos, tokens ou recursos de outros projetos.
- CNAE, regras fiscais e percentual de comissão do marketplace permanecem TBD.
