# iFarm Academy v0.44 — Governança de Privacidade Comercial

## Objetivo

Fechar o ciclo de consentimento comercial do Motor Comercial da Academy com revogação, supressão global e reautorização rastreável, sem apagar a evidência histórica necessária para auditoria.

## Princípios

1. Consentimento original é evidência histórica e não é sobrescrito.
2. Revogação é um novo evento append-only.
3. Bloqueio global e revogação individual são conceitos diferentes.
4. Reativar o contato global não recria consentimentos individuais revogados.
5. Reautorizar exige consentimento explícito verificável e versão válida.
6. Handoffs ainda não entregues são cancelados quando o contato é bloqueado/revogado.
7. Handoffs entregues e conversões confirmadas permanecem preservados como fatos históricos.
8. Tenant e usuário vêm do identity boundary confiável; não são aceitos como autoridade do navegador.

## Estados

### Preferência global

- `available`: o usuário não possui bloqueio global ativo.
- `suppressed`: novos contatos, novas oportunidades e novos handoffs comerciais estão bloqueados.

Eventos:
- `suppress_all`
- `resume`

### Consentimento por oportunidade

- `granted`: consentimento original ou reautorização válida permanece efetivo.
- `revoked`: o usuário revogou aquela oportunidade específica.

Eventos:
- `revoked`
- `regranted`

Estado efetivo de contato:

`contactAllowed = globalState == available AND opportunityState == granted`

## Ordem dos eventos

As tabelas de eventos possuem `seq INTEGER PRIMARY KEY AUTOINCREMENT`.

Isso evita depender de timestamp ou UUID para determinar o último estado. Mesmo que duas mudanças ocorram no mesmo milissegundo, a sequência do banco define a ordem real.

## Reautorização

### Oferta baseada em regra

Só pode ser reautorizada quando:
- a oportunidade veio de `explicit_rule_opt_in`;
- a regra permanece `active`;
- a versão apresentada na reautorização é igual à versão atual da regra.

### Smart Farm Experience

Interesses com `explicit_event_interest` podem ser reautorizados usando o snapshot explícito/versionado originalmente apresentado.

### Legado

`legacy_event_interest` não recebe consentimento inventado retroativamente e não pode ser reautorizado sem um novo fluxo explícito.

## Handoffs

Após `suppress_all` ou `revoked`:
- novos handoffs são rejeitados;
- transições para `pending`, `processing` ou `delivered` são rejeitadas pelo banco;
- APIs cancelam handoffs locais ainda em `pending`, `processing` ou `failed`.

Um adapter externo futuro deve revalidar o consentimento imediatamente antes de qualquer chamada para CRM/iFarm Core.

## APIs

### Self-service

`GET /api/commercial-privacy`

Retorna:
- preferência global atual;
- último evento global;
- oportunidades do usuário;
- estado individual;
- estado efetivo de contato;
- dados necessários para eventual reautorização.

`POST /api/commercial-privacy`

Ações:
- `suppress_all`
- `resume`
- `revoke`
- `regrant`

### Administração / solicitação LGPD

`POST /api/commercial-privacy-admin`

Exige papel administrativo e `reason` obrigatório. A origem do evento é registrada como `admin_privacy_request`.

## Proteções de banco

Migration `0032_commercial_consent_governance.sql`:
- eventos append-only;
- isolamento oportunidade/tenant/usuário;
- bloqueio de novas oportunidades após supressão global;
- bloqueio de handoff por estado efetivo de consentimento;
- regrant apenas com evidência explícita verificável;
- ordenação monotônica por sequência.

## Escopo LGPD

Esta implementação trata governança de consentimento comercial dentro da Academy. Ela não substitui:
- política de privacidade institucional;
- registro de bases legais em outros sistemas iFarm;
- fluxo formal de atendimento ao titular;
- retenção legal/fiscal;
- anonimização/eliminação em sistemas externos;
- DPO/encarregado e processo jurídico da organização.

Integração com CRM deve respeitar o mesmo estado de consentimento e não pode usar dados históricos para recriar contato após revogação.
