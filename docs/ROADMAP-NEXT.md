# Próximas camadas — iFarm Academy

## Concluído até v0.28
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
- Editor e renderização segura de `content_json` por tipo de aula.
- Storage de materiais e contrato de mídia desacoplado do provedor.
- Snapshot acadêmico imutável no certificado.
- Página pública de validação e QR Code local.
- Testes HTTP das Pages Functions e fixtures D1-compatible.
- CI com migrations, integração de banco, typecheck, testes e build.
- Área empresarial com empresas e colaboradores vinculados ao `userId` iFarm.
- Atribuição de curso publicado com obrigatoriedade e prazo.
- Matrícula conciliada automaticamente ao atribuir um curso.
- Conclusões existentes preservadas e nunca reabertas por uma atribuição corporativa.
- Painel empresarial com progresso, atrasos e certificados.
- Trilhas empresariais configuráveis por empresa e tenant.
- Cursos obrigatórios ordenados dentro da trilha.
- Atribuição de trilha reutilizando cursos/matrículas existentes sem duplicar entitlement.
- Progresso agregado e atraso por trilha.
- Periodicidade de treinamento configurável, sem inferir prazo regulatório.
- Monitor de renovações vencidas/próximas/futuras.
- `academy_learning_cycles` como fonte de verdade para passagens recorrentes pelo curso.
- Backfill de dados anteriores como ciclo 1.
- Progresso isolado por `cycle_id`.
- Tentativas e limites de avaliação isolados por ciclo.
- Certificados históricos múltiplos por curso, um por ciclo.
- Atribuições corporativas ligadas ao ciclo acadêmico correspondente.
- Conclusão de ciclo fechando matrícula, atribuição corporativa e trilha obrigatória quando aplicável.
- Renovação empresarial criando ciclo novo sem copiar progresso, respostas, notas ou certificado anterior.
- Gate de CI específico para migration e isolamento entre ciclos.

## Próximas prioridades
1. Lockfile íntegro e migração do CI de `npm install` para `npm ci` quando puder ser gerado em ambiente com rede e integridade verificável.
2. Provisionamento exclusivo de Cloudflare Pages + D1 + storage para STAGE.
3. Integração definitiva com sessão/RBAC do iFarm Core, incluindo escopo confiável de `company_admin` por empresa.
4. Eventos/Smart Farm Experience conectados a inscrições, presença e evidências.
5. Gestão de instrutores, qualificações e responsabilidade técnica.
6. Adapter do provedor de streaming escolhido após decisão de infraestrutura.
7. Relatórios acadêmicos e corporativos essenciais do MVP.
8. Checkout e Mercado Pago após identity boundary real e validações comerciais/fiscais.
9. Hardening operacional: observabilidade, backup/restore, rate limiting e alertas.
10. Governança de validade/expiração pública de certificados regulatórios, separada da simples periodicidade de treinamento.

## Governança
- `develop` é a linha de integração.
- `main` e produção permanecem fora das mudanças até homologação do STAGE.
- Não reutilizar secrets, bancos, tokens, buckets ou recursos de outros projetos.
- O papel `company_admin` só deve ser liberado em homologação/produção quando o iFarm Core fornecer escopo confiável da empresa administrada.
- Nenhuma periodicidade regulatória deve ser hardcoded. A Academy armazena a política configurada e sua evidência, mas a regra aplicável precisa ser validada tecnicamente/juridicamente.
- Iniciar novo ciclo de treinamento não revoga automaticamente certificado anterior; validade pública deve ser política explícita.
- CNAE, regras fiscais e percentual de comissão do marketplace permanecem TBD.
