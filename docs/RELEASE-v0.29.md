# iFarm Academy v0.29 — Eventos & Smart Farm Experience

## Objetivo
Adicionar a primeira vertical funcional de eventos da Academy para workshops, dias de campo, aulas práticas, treinamentos e webinars, incluindo a Smart Farm como fazenda-escola e laboratório vivo.

## Modelo de dados
Migration `0015_events_smart_farm.sql` cria:
- `academy_events`;
- `academy_event_registrations`;
- `academy_event_attendance_evidence`.

Os registros são tenant-aware e protegidos por triggers de integridade para evento, empresa e inscrição.

## Eventos
Suporta:
- workshop;
- dia de campo;
- aula prática;
- treinamento;
- webinar;
- outros eventos.

Modalidades:
- presencial;
- online;
- híbrida.

Modelo de acesso:
- gratuito;
- patrocinado;
- pago.

Eventos podem registrar capacidade, prazo de inscrição, local, endereço, link online e sinalização `smart_farm_experience`.

## Regra comercial
A v0.29 modela eventos pagos, mas não permite inscrição direta neles. O backend retorna `checkoutRequired=true` até que o fluxo de checkout/Mercado Pago seja implementado e homologado.

Isso evita criar entitlement pago sem confirmação financeira.

## Inscrições
- evento publicado gratuito/patrocinado aceita inscrição;
- capacidade disponível gera `registered`;
- capacidade esgotada gera `waitlisted`;
- inscrição é única por tenant/evento/usuário;
- cancelamento pelo participante preserva histórico;
- quando uma vaga registrada é cancelada, a primeira pessoa da fila pode ser promovida;
- prazo de inscrição e encerramento do evento são respeitados.

## Presença e evidências
A operação administrativa permite:
- listar participantes;
- check-in;
- checkout;
- registrar ausência;
- anexar evidência de presença.

Tipos de evidência preparados:
- manual;
- código de check-in;
- QR Code;
- geolocalização;
- assinatura;
- documento.

A v0.29 usa evidência manual na interface inicial. Os demais tipos ficam preparados para evolução.

## Interface
Nova aba `Eventos` no workspace da Academy com:
- agenda publicada;
- cards de eventos;
- identificação Smart Farm Experience;
- vagas e lista de espera;
- minhas inscrições;
- criação administrativa;
- publicação/cancelamento;
- lista de participantes;
- check-in, checkout e ausência.

## Segurança
- criação/edição/cancelamento: `academy_admin` ou `ifarm_admin`;
- presença: `academy_admin`, `ifarm_admin` ou `academy_instructor`;
- catálogo e inscrição: usuário autenticado pelo identity boundary iFarm;
- eventos pagos não contornam checkout;
- tenant isolation validado no banco.

## Testes
- regras unitárias para inscrição, capacidade, fila, prazo e evento pago;
- fixture D1-compatible de evento Smart Farm;
- valida inscrição confirmada + lista de espera;
- valida evidência de presença;
- valida unicidade de inscrição;
- bloqueia tenant/evento incompatível;
- bloqueia empresa de outro tenant;
- bloqueia evidência vinculada a outro evento.

## Deploy
Nenhum deploy nesta release. Destino: `develop` após CI totalmente verde.
