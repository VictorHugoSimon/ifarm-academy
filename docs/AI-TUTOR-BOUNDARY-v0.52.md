# Tutor IA — Boundary de Segurança v0.52

## Escopo desta versão
O Tutor IA da v0.52 funciona exclusivamente em **modo evidência**. Não existe provedor LLM, token de IA, busca na internet ou geração de resposta técnica livre.

## Fonte autorizada
O backend só consulta conteúdo de aulas pertencentes a um curso:
1. do tenant autenticado;
2. com status acadêmico publicado ou arquivado;
3. em que o usuário possui matrícula ativa ou concluída.

Somente campos textuais autorizados do conteúdo da aula entram no retrieval (`body`, `instructions`, `label`), além dos títulos de módulo/aula. URLs, provider refs, storage refs e segredos não entram na base de resposta.

## Sem evidência
Se a pergunta não tiver correspondência suficiente no conteúdo autorizado, o Tutor deve responder que não encontrou base suficiente. Ele não completa a lacuna com conhecimento presumido.

## Histórico
Sessões são vinculadas a `tenant_id + user_id + course_id`. Mensagens são append-only e guardam snapshot das citações exibidas naquele momento.

## Futuro provedor de IA
Uma integração futura com LLM deverá consumir apenas o evidence pack autorizado produzido por esta camada e preservar citações. A adoção de qualquer provedor, modelo, retenção ou política de dados continua TBD e exige avaliação de segurança/LGPD antes de ativação.
