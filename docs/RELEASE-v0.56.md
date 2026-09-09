# Release v0.56 — AI Tutor Foundation

A v0.56 cria a base segura do iFarm Academy AI Tutor sem ativar geração externa prematuramente.

### Destaques
- conhecimento restrito a conteúdo acadêmico publicado e autorizado;
- segregação por tenant e matrícula;
- indexação reconstruível de aulas;
- respostas `evidence_only` com citações;
- recusa explícita quando o contexto é insuficiente;
- sessões e histórico de mensagens;
- UX integrada ao workspace;
- nenhum provedor externo ou credencial necessário.

### Gate
Merge somente com CI verde: `npm ci`, typecheck, testes, 34 migrations, todas as fixtures, contrato de STAGE/deploy e build.

### Segurança
O Tutor não deve transformar ausência de fonte em opinião técnica. Conteúdo técnico não encontrado nas fontes autorizadas deve resultar em `insufficient_context`.
