# RELEASE — iFarm Academy v0.49.0

A v0.49 amplia a integração real de sessão iFarm Core/Neon Auth no frontend e reduz a dependência do interceptor de compatibilidade. Os módulos protegidos passam a enviar Bearer explicitamente, enquanto superfícies realmente públicas permanecem anônimas.

Também corrige o check-in da Smart Farm Experience: o QR abre a rota pública, mas a ação só ocorre após autenticação iFarm e confirmação do usuário. O token não identifica sozinho o participante.

## Segurança
- nenhum Bearer é enviado para upload externo assinado;
- validação pública de certificado permanece pública;
- health/readiness permanecem públicos;
- tenant e identidade continuam sendo autoridade do iFarm Core;
- nenhuma credencial real foi adicionada.

## Próximo passo
v0.50: migrar `enterpriseApi.ts` e `commercialApi.ts`, auditar os últimos transports protegidos e remover o interceptor global de compatibilidade somente após CI verde.
