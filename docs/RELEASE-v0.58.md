# Release v0.58 — AI Tutor Provider Boundary

A v0.58 prepara geração grounded no Tutor IA sem acoplar a Academy a um fornecedor específico e sem ativar credenciais externas por padrão.

### Destaques
- adapter server-side `gateway_v1`, desligado por padrão;
- autorização generativa separada da autorização de conteúdo;
- aprovação vinculada à versão publicada do curso;
- opt-in do aluno em cada pergunta antes de qualquer envio externo;
- minimização de dados com remoção de IDs internos e redação best-effort de e-mail, CPF e telefone;
- fontes tratadas como dados, não como instruções;
- JSON estrito, `grounded=true` e citações `[S#]` obrigatórias em cada parágrafo;
- qualquer erro, timeout ou resposta inválida retorna automaticamente a `evidence_only`;
- telemetria append-only sem duplicar prompt/resposta;
- nenhum token/secret no frontend ou repositório.

### O que não muda
O Tutor continua funcional sem provider externo. `evidence_only` e `insufficient_context` permanecem comportamentos seguros e oficiais.

### Não ativado nesta release
- OpenAI/Anthropic/Gemini específicos;
- credenciais reais;
- cobrança/token budget externo;
- deploy de provider em produção.

### Gate
Merge somente com CI verde: `npm ci`, typecheck, testes, 36 migrations, fixtures de Tutor/governança/provider, contratos de STAGE/deploy e build.
