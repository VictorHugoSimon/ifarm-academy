# Próximas camadas — iFarm Academy

## Concluído até v0.22
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
- Validação de conteúdo mínimo antes da publicação do curso.
- Storage de materiais preparado com metadados autoritativos no D1.
- Reserva, upload, entrega autenticada e remoção de materiais.
- Chaves de objeto segregadas por tenant/curso/aula/asset.
- Validação de nome, extensão, MIME e tamanho antes do upload.
- Limite inicial de 100 MB por material.
- Student Player entrega materiais internos por endpoint autenticado.
- Binding `ACADEMY_STORAGE` opcional e isolado por ambiente.
- Exemplo de R2 preparado sem provisionar recurso real.

## Próximas prioridades
1. Preparação do streaming de vídeo e retomada real por posição.
2. Página pública completa de validação do certificado + QR Code.
3. Testes de integração das Pages Functions com D1 isolado e fixtures reais.
4. Lockfile íntegro e migração do CI de `npm install` para `npm ci`.
5. Provisionamento exclusivo de Cloudflare Pages + D1 + storage para STAGE.
6. Integração definitiva com sessão/RBAC do iFarm Core.
7. Painel empresarial com atribuição de cursos e trilhas obrigatórias.
8. Eventos/Smart Farm Experience conectados a inscrições e presença.
9. Gestão de instrutores e responsabilidade técnica.
10. Mercado Pago somente após identity boundary real, webhook assinado e validações comerciais/fiscais.

## Governança
- `develop` é a linha de integração.
- `main` e produção permanecem fora das mudanças até homologação do STAGE.
- Não reutilizar secrets, bancos, tokens, buckets ou recursos de outros projetos.
- CNAE, regras fiscais e percentual de comissão do marketplace permanecem TBD.
