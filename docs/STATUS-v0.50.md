# STATUS — iFarm Academy v0.50

## Objetivo
Concluir a migração do frontend protegido para Bearer Neon/iFarm Core explícito e remover o interceptor global de compatibilidade introduzido na v0.47.

## Concluído
- `enterpriseApi.ts` usa `authenticatedFetch` explicitamente;
- `commercialApi.ts` usa `authenticatedFetch` explicitamente;
- `main.tsx` não instala mais interceptor global de `fetch`;
- `workspaceApiTransport.ts` e seu teste foram removidos;
- módulos públicos continuam usando transporte público onde aplicável;
- sessão, identidade e tenant continuam sendo autoridade do iFarm Core.

## Segurança
- ausência de sessão em chamada protegida falha no transporte autenticado;
- nenhum header `x-ifarm-*` é confiado a partir do browser;
- nenhum Bearer é adicionado globalmente a requests arbitrários;
- URLs externas continuam fora do transporte autenticado da Academy;
- nenhum secret ou token real foi versionado.

## Resultado arquitetural
O frontend protegido deixou de depender de monkey patch/interceptação de `globalThis.fetch`. Cada domínio protegido declara o transporte autenticado que utiliza.

## Próximo bloco
Validar em STAGE a sessão Neon/iFarm Core real, troca de tenant, isolamento de dados e comportamento de expiração de sessão. Provisionamento e secrets continuam sendo ação de ambiente, não código.
