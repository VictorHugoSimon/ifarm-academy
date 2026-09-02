# Próximas camadas — iFarm Academy

## Concluído até v0.19
- Identidade administrativa fail-closed preparada para o iFarm Core.
- Correção manual auditável e política de quiz versionada.
- Certificação automática após elegibilidade.
- Isolamento inicial por tenant.
- Course Builder persistido em API/D1.
- Quiz Builder conectado à política server-side.
- Vínculo explícito curso → avaliação.
- Workflow de publicação `draft → review → published → archived`.
- Catálogo tenant-aware de cursos publicados.
- Matrícula server-side idempotente com cancelamento/reativação e auditoria.

## Próximas prioridades
1. Área do aluno conectada à matrícula e ao progresso server-side por aula.
2. Student Player consumindo módulos/aulas do curso publicado no D1.
3. Conclusão automática da matrícula quando os requisitos forem atendidos.
4. Certificado associado à matrícula concluída e página pública de validação completa.
5. Testes de integração das Pages Functions com D1 isolado.
6. Lockfile íntegro e migração do CI para `npm ci`.
7. Provisionamento exclusivo de Cloudflare Pages + D1 para STAGE.
8. Integração definitiva com sessão/RBAC do iFarm Core.
9. Streaming de vídeo após definição/provisionamento do provedor.
10. Mercado Pago somente após identity boundary real, webhook assinado e validações comerciais/fiscais.

## Governança
- `develop` é a linha de integração.
- `main` e produção permanecem fora das mudanças até homologação do STAGE.
- Não reutilizar secrets, bancos, tokens ou recursos de outros projetos.
- CNAE, regras fiscais e percentual de comissão do marketplace permanecem TBD.
