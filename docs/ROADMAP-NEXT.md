# Próximas camadas — iFarm Academy

## Concluído até v0.24
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
- Contrato de mídia desacoplado do provedor.
- Endpoint autenticado de resolução de playback.
- Player HTML5 de vídeo e áudio com retomada real de posição.
- Progresso de mídia salvo periodicamente e ao pausar.
- Conclusão de mídia registrada automaticamente ao término.
- Snapshot acadêmico imutável no certificado.
- Instrutor/responsável, carga horária, tipo e conclusão preservados na emissão.
- Publicação exige metadados mínimos de certificação.
- API pública de validação ampliada.
- Página pública de validação sem login.
- QR Code gerado pela própria aplicação, sem serviço externo.
- Aba Certificação conectada aos certificados reais do aluno.

## Próximas prioridades
1. Testes de integração das Pages Functions com D1 isolado e fixtures reais.
2. Lockfile íntegro e migração do CI de `npm install` para `npm ci`.
3. Provisionamento exclusivo de Cloudflare Pages + D1 + storage para STAGE.
4. Integração definitiva com sessão/RBAC do iFarm Core.
5. Painel empresarial com atribuição de cursos e trilhas obrigatórias.
6. Eventos/Smart Farm Experience conectados a inscrições e presença.
7. Gestão de instrutores e responsabilidade técnica.
8. Adapter do provedor de streaming escolhido após decisão de infraestrutura.
9. Relatórios acadêmicos essenciais do MVP.
10. Mercado Pago somente após identity boundary real, webhook assinado e validações comerciais/fiscais.

## Governança
- `develop` é a linha de integração.
- `main` e produção permanecem fora das mudanças até homologação do STAGE.
- Não reutilizar secrets, bancos, tokens, buckets ou recursos de outros projetos.
- CNAE, regras fiscais e percentual de comissão do marketplace permanecem TBD.
