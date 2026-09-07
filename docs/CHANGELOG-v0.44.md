# Changelog — v0.44.0

## Added

- governança de preferência global de contato comercial;
- revogação e reautorização por oportunidade;
- API self-service de privacidade comercial;
- API administrativa para solicitações de privacidade;
- página de preferências comerciais;
- estado de consentimento nas recomendações;
- fixture de integração específica;
- testes unitários de estado de consentimento.

## Changed

- opt-in comercial respeita supressão global e revogação anterior;
- Smart Farm Experience respeita preferência global;
- handoff comercial exige consentimento efetivo no momento da criação/transição;
- eventos de privacidade passaram a usar sequência monotônica;
- CI valida 32 migrations e o contrato de revogação.

## Security / LGPD

- suppress/revoke agora são fail-closed no API e no SQLite;
- handoffs não entregues são cancelados ao bloquear contato;
- histórico original permanece imutável;
- regrant exige versão explícita verificável;
- `resume` não reautoriza uma oportunidade individualmente revogada.

## Intencionalmente fora do escopo

- deploy;
- integração real com CRM/iFarm Core;
- credenciais;
- exclusão de dados em sistemas externos;
- decisões jurídicas de retenção.
