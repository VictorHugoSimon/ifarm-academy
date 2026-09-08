# STATUS — iFarm Academy v0.52

## Objetivo
Preparar a homologação real de STAGE sem provisionar infraestrutura por código nem declarar prontidão antes das dependências obrigatórias existirem.

## Concluído
- `readiness` exige iFarm Core em STAGE/PRODUCTION;
- DEV/testes preservam fallback legado temporário;
- smoke test seguro para health, readiness, portal e sessão autenticada opcional;
- Bearer nunca é impresso pelo smoke;
- contrato offline do smoke adicionado ao CI;
- validação explícita de `identityMode=core_api` em STAGE;
- validação opcional da release esperada;
- runbook de homologação com matriz de login, tenant, MFA e isolamento;
- `.env.example` alinhado à v0.52;
- versão `0.52.0`.

## Segurança
- nenhuma credencial real foi adicionada ao repositório;
- smoke público não envia Bearer;
- token de homologação é opcional e recebido somente por variável de ambiente;
- `main`, produção e iFarm Core não são alterados por esta versão.

## Próximo passo
Provisionar recursos exclusivos de STAGE e executar o runbook real. Até isso acontecer, a Academy continua em `develop` sem promoção para produção.
