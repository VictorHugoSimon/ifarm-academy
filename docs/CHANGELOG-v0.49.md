# CHANGELOG — v0.49.0

## Changed
- Eventos, gamificação, instrutores, marketplace, notificações, planos, relatórios, white label e validade de certificados agora usam Bearer Neon explícito.
- Media playback e persistência API padrão agora usam transporte autenticado explícito.
- Materiais usam Bearer em reserva/upload same-origin e preservam upload externo assinado sem Authorization da Academy.
- Certificados privados foram separados da validação pública.
- Health/readiness foram separados do painel operacional protegido.
- Governança do portal público usa transporte autenticado explícito.

## Fixed
- `/smart-farm/checkin` agora exige sessão iFarm Core antes de executar check-in/check-out/estação.
- QR/token sozinho não é suficiente para identificar participante.

## Deferred
- `enterpriseApi.ts` e `commercialApi.ts` ficam para v0.50.
- interceptor de compatibilidade do `/app` ainda não foi removido.
