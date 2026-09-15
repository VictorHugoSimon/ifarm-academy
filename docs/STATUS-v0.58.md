# STATUS — iFarm Academy v0.58

## Escopo
AI Tutor Provider Boundary & Safety Contract, mantendo `evidence_only` como fallback permanente e sem ativar um fornecedor específico por padrão.

## Entregue
- migration `0036_tutor_provider_boundary.sql`;
- adapter server-side provider-neutral `gateway_v1`;
- provider desligado por padrão;
- segunda autorização administrativa, separada da autorização de conteúdo do Tutor;
- autorização generativa vinculada exatamente à versão publicada do curso (`course.updated_at`);
- qualquer alteração/despublicação do curso revoga automaticamente a autorização generativa;
- opt-in do aluno por pergunta para permitir geração externa;
- sem opt-in do aluno, nenhuma chamada externa é realizada;
- envelope externo com no máximo 5 evidências autorizadas;
- IDs de tenant/aluno não entram no envelope;
- redação best-effort de e-mail, CPF e telefone em pergunta/fontes antes do gateway;
- fontes tratadas como dados não confiáveis contra prompt injection;
- resposta externa aceita somente com `grounded=true` e JSON válido;
- cada parágrafo precisa conter citação inline `[S#]` válida;
- citação inexistente, ausente ou não inline invalida toda a resposta;
- timeout, tamanho máximo e HTTPS obrigatório (HTTP apenas localhost DEV);
- qualquer timeout/erro/resposta inválida retorna ao modo `evidence_only`;
- observabilidade append-only de outcome/latência/contagens, sem duplicar pergunta ou resposta na tabela de eventos;
- UI de governança e consentimento integrada ao Tutor;
- fixture de integração e gate dedicado no CI.

## Regra de privacidade
A autorização administrativa para uso do conteúdo no Tutor não autoriza automaticamente envio a provedor externo. O envio só pode ocorrer quando coexistem: conteúdo autorizado, curso publicado, versão generativa explicitamente aprovada, runtime server-side configurado, evidência disponível e opt-in do aluno na pergunta atual.

A redação de identificadores estruturados é uma camada de minimização de dados, não uma garantia de anonimização completa. Conteúdo autorizado ainda deve ser revisado antes de ser habilitado para geração externa.

## Provider
Esta versão não integra diretamente OpenAI, Anthropic, Gemini ou outro fornecedor. O contrato `gateway_v1` mantém o domínio da Academy desacoplado da escolha futura de fornecedor.

## Segurança
- nenhum token de provider é exposto no browser;
- `ACADEMY_TUTOR_PROVIDER_TOKEN` é exclusivamente server-side;
- nenhuma credencial real é versionada;
- respostas não grounded nunca são promovidas a resposta técnica;
- `evidence_only` continua funcional mesmo com provider indisponível.

## Fora do escopo
- contratação/seleção de fornecedor;
- credenciais reais;
- vector database/embedding externo;
- orçamento financeiro de tokens;
- deploy de provider em STAGE/PRODUCTION;
- alteração no iFarm Core.

## Próximo bloco sugerido
v0.59 — quotas/budgets por tenant/curso/aluno, telemetria de tentativas de prompt injection e painel operacional do Tutor, mantendo provider externo opcional.
