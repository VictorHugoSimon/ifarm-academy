# STATUS — iFarm Academy v0.56

## Escopo
AI Tutor Foundation com retrieval de conteúdo autorizado e comportamento fail-safe sem provedor generativo.

## Entregue
- migration `0034_ai_tutor_foundation.sql`;
- chunks derivados apenas de `body` e `instructions` das aulas;
- indexação somente de cursos `published` no mesmo tenant;
- nenhuma URL privada, `providerRef`, gabarito ou segredo entra no índice;
- sessões e mensagens segregadas por tenant/aluno/curso;
- consulta do Tutor exige matrícula ativa ou concluída no curso;
- retrieval lexical determinístico com ranking por termos;
- até 5 evidências citadas por resposta;
- modo `evidence_only` sem afirmação técnica além do conteúdo publicado;
- modo `insufficient_context` quando não existe base autorizada suficiente;
- histórico de sessões;
- tela `Tutor IA` no workspace;
- administradores podem reconstruir o índice de cursos publicados;
- fixture de isolamento e novo gate no CI.

## Regra de segurança
A ausência de um provedor de IA não é tratada como erro a ser mascarado. Nesta versão `providerConfigured=false` é explícito. O Tutor apresenta evidências ou informa que não encontrou contexto suficiente.

## Não implementado nesta versão
- nenhuma chamada para OpenAI ou outro provedor;
- nenhum embedding/vector DB externo;
- nenhuma resposta generativa;
- nenhum uso de conteúdo não autorizado;
- nenhum acesso a cursos sem matrícula;
- nenhuma alteração no iFarm Core.

## Próximo bloco
v0.57 pode introduzir um provider adapter server-side, desde que haja configuração exclusiva da Academy, política de prompt/citação e fallback obrigatório para `evidence_only`.
