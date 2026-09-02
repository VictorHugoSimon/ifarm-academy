# Próximas camadas — iFarm Academy

## Concluído até v0.23
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
- URL bruta de vídeo/áudio removida do payload geral do curso.
- Player HTML5 de vídeo e áudio com retomada real de posição.
- Progresso de mídia salvo periodicamente e ao pausar.
- Conclusão de mídia registrada automaticamente ao término.
- Curso não permite conclusão manual de aula de vídeo/áudio no modo server-side.
- Referências de provedor sem adapter ativo falham de forma fechada, sem inventar URL de reprodução.

## Próximas prioridades
1. Página pública completa de validação do certificado + QR Code.
2. Testes de integração das Pages Functions com D1 isolado e fixtures reais.
3. Lockfile íntegro e migração do CI de `npm install` para `npm ci`.
4. Provisionamento exclusivo de Cloudflare Pages + D1 + storage para STAGE.
5. Integração definitiva com sessão/RBAC do iFarm Core.
6. Painel empresarial com atribuição de cursos e trilhas obrigatórias.
7. Eventos/Smart Farm Experience conectados a inscrições e presença.
8. Gestão de instrutores e responsabilidade técnica.
9. Adapter do provedor de streaming escolhido após decisão de infraestrutura.
10. Mercado Pago somente após identity boundary real, webhook assinado e validações comerciais/fiscais.

## Governança
- `develop` é a linha de integração.
- `main` e produção permanecem fora das mudanças até homologação do STAGE.
- Não reutilizar secrets, bancos, tokens, buckets ou recursos de outros projetos.
- CNAE, regras fiscais e percentual de comissão do marketplace permanecem TBD.
