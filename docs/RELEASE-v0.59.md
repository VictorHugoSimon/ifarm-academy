# Release v0.59 — AI Tutor Usage Guardrails

A v0.59 adiciona controle operacional explícito à geração externa do Tutor, preservando `evidence_only` como fallback permanente.

### Destaques
- quota versionada por tenant/curso/aluno;
- limites de chamadas e caracteres, sem valores padrão;
- reserva atômica antes do provider para proteger concorrência;
- prompt-injection guardrails em pergunta e fontes;
- telemetria de bloqueios sem armazenar pergunta bruta;
- painel operacional e governança de políticas;
- provider externo continua opcional/desligado por padrão.

### Gate
Merge somente com `npm ci`, typecheck, testes, **37 migrations**, todas as fixtures — incluindo Tutor/provider/guardrails — contratos STAGE/deploy e build verdes.

### Regra financeira
Nenhum dado de caracteres/chamadas é apresentado como custo monetário ou tokens faturados. Essa camada depende do contrato do fornecedor futuro.
