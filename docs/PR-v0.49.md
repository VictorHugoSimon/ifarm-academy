# PR — iFarm Academy v0.49

## Objetivo
Expandir o transporte Bearer Neon/iFarm Core explícito para os módulos protegidos restantes de menor e médio porte, preservando endpoints verdadeiramente públicos e impedindo vazamento de Authorization para storage externo.

## Principais mudanças
- eventos, gamificação, instrutores, marketplace, notificações, planos, relatórios, white label, validade, media, materiais e governança do portal usam transporte autenticado explícito;
- certificados privados separados da validação pública;
- health/readiness continuam públicos; operações administrativas exigem Bearer;
- QR Smart Farm agora exige sessão Core antes da confirmação;
- upload externo assinado nunca recebe Bearer da Academy;
- `enterpriseApi.ts` e `commercialApi.ts` permanecem no interceptor de compatibilidade até a v0.50.

## Gate
Merge somente com CI integralmente verde.
