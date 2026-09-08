# CHANGELOG — v0.51.0

## Added
- evento de expiração de sessão para chamadas protegidas;
- contexto React compartilhado com snapshot validado pelo iFarm Core;
- projeção conservadora de privilégio para a navegação.

## Changed
- `AcademySessionGate` encerra sessão local após `401` de API protegida;
- usuários não administrativos iniciam pelo catálogo;
- tabs claramente administrativas refletem papel/MFA do Core;
- versão atualizada para `0.51.0`.

## Security
- navegação não substitui autorização server-side;
- `ifarm_admin` continua sendo exigido para Operações;
- MFA bloqueia projeção privilegiada quando requerido.
