# iFarm Academy v0.40 — Trilhas Públicas + Perfis de Instrutor

## Objetivo
Expandir o Portal Público com jornadas de aprendizagem e especialistas, sem reutilizar indevidamente trilhas empresariais nem expor dados privados da governança profissional.

## Entregas
- `/paths` e `/paths/{slug}`;
- `/instructors` e `/instructors/{slug}`;
- perfis públicos vinculados ao `academy_instructors` existente, sem duplicar instrutor;
- perfil público opt-in com slug, headline, bio, foto, especialidades, resumo profissional e SEO;
- nenhuma evidência, número de conselho ou registro profissional é publicado automaticamente;
- trilhas públicas comerciais separadas das trilhas corporativas obrigatórias;
- cursos ordenados por trilha;
- visibilidade, categoria, capa, destaque, SEO e modelo de acesso;
- preço opcional somente para apresentação; checkout permanece bloqueado;
- trilha pública exige ao menos um curso academicamente publicado e publicamente visível;
- perfis e trilhas respeitam escopo White Label em tempo de consulta;
- páginas de instrutor mostram somente cursos públicos nos papéis de autor/instrutor;
- responsabilidade técnica, revisão e qualificações privadas permanecem fora do contrato público;
- painel `Trilhas & Instrutores Públicos` no workspace;
- migration `0025_public_paths_instructors.sql`;
- testes de validação e fixture D1-compatible;
- gate CI específico;
- versão `0.40.0`.

## Separação de domínio
`academy_company_learning_paths` continua representando trilhas empresariais, com atribuição, obrigatoriedade e renovação. `academy_public_learning_paths` é a projeção comercial pública e não herda periodicidade regulatória ou obrigação corporativa.

## Segurança
- tenant continua derivado exclusivamente do host público aprovado;
- perfil público é opt-in;
- instrutor inativo não pode ficar público;
- curso cross-tenant não pode entrar em trilha;
- catálogo White Label filtra cursos de trilhas e instrutores;
- nenhum dado privado de qualificação é copiado para o perfil público.

## Limites
Sem checkout, Mercado Pago, repasse, assinatura ou aquisição de trilha nesta release. `main` e produção permanecem intactos.
