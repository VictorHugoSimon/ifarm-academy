# iFarm Academy — Status v0.15

## Entrega
Boundary de identidade administrativa fail-closed, preparando a integração futura com o iFarm Core sem criar autenticação paralela.

## Implementado
- helper `_auth.ts` para contexto administrativo confiável;
- segredo de proxy exclusivo do ambiente como pré-condição;
- leitura de identidade, tenant e papéis injetados por camada confiável;
- proteção da fila de revisões;
- proteção da correção manual;
- proteção da administração/versionamento das políticas de quiz;
- `reviewerId` e `actorId` deixam de ser autoritativos quando enviados pelo browser e passam a vir do contexto autenticado;
- testes de 503/401/403 e cenário autorizado;
- documentação do contrato de segurança;
- versão 0.15.0.

## Comportamento de segurança
- sem configuração do boundary: 503;
- segredo inválido: 401;
- papel insuficiente: 403;
- identidade e papel válidos: operação permitida.

## Papéis utilizados
- `academy_admin`
- `academy_reviewer`
- `ifarm_admin`

## Governança
- `main` e produção permanecem intactos;
- branch: `feature/admin-auth-boundary-v0.15`;
- sem deploy;
- sem secrets reais no GitHub;
- sem reutilizar recursos de outros projetos;
- CNAE, regras fiscais e comissão marketplace permanecem TBD;
- Layout Master preservado.

## Próxima prioridade
- integrar contrato real de sessão/RBAC do iFarm Core;
- isolamento por tenant nos endpoints administrativos;
- rate limiting e auditoria operacional;
- emissão automática de certificado após elegibilidade;
- testes das Functions com D1 isolado;
- STAGE somente após provisionamento exclusivo da Academy.
