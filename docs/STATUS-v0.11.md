# iFarm Academy — Status v0.11

## Entrega
Camada de backend executável adicionada sobre os contratos de persistência v0.10, sem provisionar infraestrutura e sem deploy de produção.

## Implementado
- Pages Functions para health, progresso, tentativas e certificados;
- progresso com upsert idempotente por aluno + curso + aula;
- consulta de tentativas;
- atualização de tentativa com campos imutáveis e transições de status validadas;
- política server-side de conclusão de curso;
- emissão idempotente de certificado;
- certificado só é emitido após validação server-side de progresso e avaliação;
- migration D1 para política de conclusão;
- Vitest com regras acadêmicas críticas;
- CI para typecheck + test + build;
- workflow sem deploy.

## Segurança e governança
- `main` e produção não foram alteradas;
- nenhum secret ou binding real foi criado;
- nenhum banco/token/recurso de outros projetos foi reutilizado;
- identidade/tenant continuam reservados para integração futura com iFarm Core;
- CNAE, regras fiscais e comissão de marketplace permanecem TBD;
- o Layout Master não foi alterado.

## Decisão técnica importante
O browser não é autoridade para emissão de certificado. A Function consulta uma política de conclusão configurada no backend e valida progresso e tentativa aprovada antes de persistir o certificado.

## Próxima prioridade
- endpoint de criação de tentativa com limite server-side;
- endpoint de submissão/correção automática;
- validação pública de certificado por código;
- testes das Functions com banco isolado;
- workflow separado para STAGE somente quando Cloudflare/D1 exclusivos estiverem provisionados.
