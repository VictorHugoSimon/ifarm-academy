# Release v0.57 — Tutor Content Governance

A v0.57 separa publicação acadêmica de autorização para uso em IA.

### Destaques
- opt-in explícito por curso para o Tutor;
- aprovação apenas por administrador;
- auto-indexação ao publicar curso autorizado;
- purge automático ao desautorizar, arquivar ou remover publicação;
- índice antigo da v0.56 descartado na migration para exigir reaprovação;
- consulta do aluno revalida matrícula, publicação e autorização;
- interface administrativa com estado e sincronização do índice;
- nenhum provedor generativo externo.

### Gate
Merge somente com CI verde: npm ci, typecheck, testes, **35 migrations**, fixtures incluindo Tutor governance, STAGE/deployment contracts e build.
