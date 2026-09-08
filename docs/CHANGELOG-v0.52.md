# CHANGELOG — v0.52.0

## Added
- Tutor IA em modo evidência;
- retrieval determinístico sobre aulas autorizadas;
- sessões e mensagens auditáveis;
- citações por módulo/aula;
- API `/api/tutor`;
- tela `Tutor IA`;
- migration `0034`;
- fixture e gate CI do Tutor.

## Security
- tenant e matrícula são validados server-side;
- mensagens são append-only;
- URLs/provider refs não entram no retrieval;
- sem LLM, busca web ou segredo de provedor nesta versão;
- ausência de evidência gera recusa em vez de conteúdo inventado.

## Changed
- versão atualizada para `0.52.0`.
