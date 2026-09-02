# Próximas camadas — iFarm Academy

## Concluído até v0.25
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
- Editor e renderização segura de `content_json` por tipo de aula.
- Storage de materiais com reserva, upload, entrega autenticada e remoção.
- Binding `ACADEMY_STORAGE` opcional e isolado por ambiente.
- Contrato de mídia desacoplado do provedor e player com retomada real.
- Snapshot acadêmico imutável no certificado.
- Página pública de validação e QR Code local.
- Aba Certificação conectada aos certificados reais do aluno.
- Testes HTTP das Pages Functions para certificado público e listagem do aluno.
- Fixture de integração D1-compatible cobrindo curso, matrícula, progresso e certificado.
- Testes de isolamento cross-tenant no banco.
- CI com concorrência controlada, timeout e gate separado de integração de banco.

## Próximas prioridades
1. Lockfile íntegro e migração do CI de `npm install` para `npm ci`.
2. Provisionamento exclusivo de Cloudflare Pages + D1 + storage para STAGE.
3. Integração definitiva com sessão/RBAC do iFarm Core.
4. Painel empresarial com atribuição de cursos e trilhas obrigatórias.
5. Eventos/Smart Farm Experience conectados a inscrições e presença.
6. Gestão de instrutores e responsabilidade técnica.
7. Adapter do provedor de streaming escolhido após decisão de infraestrutura.
8. Relatórios acadêmicos essenciais do MVP.
9. Checkout e Mercado Pago após identity boundary real e validações comerciais/fiscais.
10. Hardening operacional: observabilidade, backup/restore, rate limiting e alertas.

## Governança
- `develop` é a linha de integração.
- `main` e produção permanecem fora das mudanças até homologação do STAGE.
- Não reutilizar secrets, bancos, tokens, buckets ou recursos de outros projetos.
- CNAE, regras fiscais e percentual de comissão do marketplace permanecem TBD.
