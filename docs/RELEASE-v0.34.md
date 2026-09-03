# iFarm Academy v0.34 — Smart Farm Experience Operacional

## Objetivo
Transformar a Smart Farm Experience em uma operação de fazenda-escola rastreável, conectando agenda de campo, presença, evidência prática e oportunidades comerciais consentidas sem duplicar o módulo geral de Eventos.

## Entregas
- migration `0019_smart_farm_experience.sql`;
- agenda de campo por evento Smart Farm Experience;
- atividades, estações, horários, locais e ordem operacional;
- indicação de atividade que exige evidência prática;
- vínculo opcional entre atividade e tema comercial;
- tokens QR para check-in, check-out e estação;
- token bruto exibido somente na criação; banco armazena apenas SHA-256;
- janela temporal de QR limitada ao evento com tolerância técnica máxima de 24h;
- auto check-in/check-out autenticado e idempotente;
- QR de estação registrando evidência prática validada;
- evidência prática manual, geolocalização, assinatura, documento, ativo e checklist;
- revisão humana de evidências pendentes;
- landing `/smart-farm/checkin` com confirmação explícita do participante;
- área `Smart Farm Experience` separada da agenda geral de Eventos;
- cross-sell por interesse explícito;
- pipeline de lead `new → qualified → contacted → converted/discarded`;
- fixture D1-compatible de tenant, QR, evidência e lead;
- novo gate no CI;
- versão `0.34.0`.

## LGPD e cross-sell
Presença, QR ou participação em atividade **não criam lead automaticamente**.

O lead só é criado quando o participante:
1. possui inscrição válida na Smart Farm Experience;
2. seleciona um interesse permitido;
3. confirma explicitamente que autoriza o registro do interesse e contato comercial.

A origem e o momento do consentimento ficam registrados no lead e na auditoria.

## Segurança do QR
- token bruto não é persistido;
- o D1 guarda apenas SHA-256;
- token pode ser revogado;
- validade temporal é obrigatória;
- finalidade é explícita: entrada, saída ou estação;
- estação exige item de agenda do mesmo evento/tenant;
- uso máximo pode ser configurado;
- QR não executa ação automática ao abrir: a landing exige confirmação.

## Governança
- destino apenas `develop`;
- nenhum deploy nesta release;
- `main` e produção permanecem intactos;
- evento pago continua sem entitlement/inscrição direta antes do checkout;
- nenhum secret ou recurso de outro projeto é reutilizado.
