# STATUS — iFarm Academy v0.57

## Escopo
Governança explícita do conteúdo usado pelo AI Tutor e sincronização do índice com o ciclo de publicação acadêmica.

## Regra principal
**Curso publicado não significa conteúdo autorizado para IA.**
Cada curso precisa de uma política `academy_tutor_course_policies` explicitamente habilitada por `academy_admin` ou `ifarm_admin`.

## Entregue
- migration `0035_tutor_content_governance.sql`;
- política tenant-aware por curso;
- autorização exige responsável (`approved_by`) e data (`approved_at`);
- identidade tenant/curso da política é imutável;
- índice v0.56 é limpo na migration para exigir reaprovação explícita;
- chunks e sessões só podem ser criados quando política está habilitada e curso está `published`;
- desabilitar a política purga chunks no próprio banco;
- tirar o curso de `published` purga chunks no próprio banco;
- helper transacional único para rebuild/purge;
- publicação sincroniza automaticamente fontes quando o Tutor está autorizado;
- falha de sincronização esvazia o índice em modo fail-safe sem impedir a publicação do curso;
- `return_draft`/`archive` removem fontes;
- consulta do aluno revalida a política habilitada;
- painel Tutor mostra autorização, status do curso, quantidade de chunks e última indexação;
- administradores podem autorizar/desautorizar e reconstruir fontes;
- fixture cobre autorização, isolamento, purge e histórico.

## Segurança
- publicação acadêmica e autorização para IA são decisões independentes;
- instrutor não pode aprovar sozinho o uso do curso pelo Tutor;
- conteúdo antigo não permanece pesquisável após revogação/arquivamento;
- histórico de mensagens já produzido permanece auditável;
- nenhum provedor generativo foi ativado;
- nenhuma credencial externa foi adicionada.

## Próximo bloco
Provider adapter generativo permanece opcional. Antes de ativá-lo, exigir contrato server-side, prompts com citação obrigatória, política de fallback para `evidence_only`, limites e observabilidade.
