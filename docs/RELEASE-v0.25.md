# iFarm Academy v0.25 — Integration Gates

## Entrega
- Teste HTTP da Function pública de certificados.
- Teste HTTP tenant-scoped de `my-certificates`.
- Fixture de integração D1-compatible usando SQLite com todas as migrations aplicadas em sequência.
- Cenário completo de curso, módulo, aula, matrícula, progresso e certificado.
- Verificação do snapshot acadêmico do certificado.
- Testes negativos de isolamento entre tenants para matrícula, progresso e certificado.
- CI com `concurrency` e cancelamento de execuções obsoletas.
- Timeout de segurança do job.
- Instalação sem auditoria de registry durante o gate para reduzir ruído externo.
- Gate explícito `Database integration fixtures` antes do build.

## O que este gate protege
1. Migrations quebradas ou fora de ordem.
2. Foreign keys inválidas.
3. Triggers de segregação multi-tenant regressivos.
4. Vazamento de identificadores internos na API pública de certificados.
5. Consulta de certificados sem usar tenant e estudante confiáveis.
6. Regressões TypeScript, testes e build do frontend.

## Limite atual
A suíte reproduz o contrato SQL compatível com D1 e invoca Functions com bindings controlados, mas ainda não provisiona um D1 Cloudflare remoto. O teste remoto será feito somente no STAGE exclusivo da Academy.

## Governança
Nenhum deploy, secret ou recurso Cloudflare foi criado nesta versão. `main` e produção permanecem intactos.
