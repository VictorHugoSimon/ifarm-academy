# Status — iFarm Academy v0.46

## Estado

Implementação concluída em branch e aguardando validação por PR/CI.

## Entregas

- inspeção read-only do `ifarm-core-platform/develop`;
- contrato real Neon Auth/Core API v1 documentado;
- adapter server-side para `/api/v1/me` e `/api/v1/me/permissions`;
- validação de URL Core e timeout;
- tenant derivado exclusivamente do Core;
- projeção conservadora de roles Core → Academy;
- MFA obrigatório para projeção de papéis administrativos;
- middleware que remove headers `x-ifarm-*` forjados do cliente;
- bridge interno para os endpoints existentes da Academy;
- contexto Academy enriquecido com role, permissões, MFA e fonte da identidade;
- diagnóstico autenticado `/api/core-context`;
- reutilização de `@neondatabase/auth@0.5.0-beta` no frontend;
- `authenticatedFetch` compartilhado;
- painel Operações exibindo estado da integração Core;
- readiness informando modo `core_api` ou `legacy_proxy`;
- testes unitários/contratos para Core adapter e header stripping;
- versão `0.46.0`.

## Decisões

1. Não modificar o repositório Core nesta release.
2. Não duplicar User/Tenant/Membership/Role do Core.
3. Código/migrations Neon atuais são fonte de verdade; documentação Supabase antiga do Core é dívida documental.
4. O browser nunca é autoridade para `x-ifarm-user-id`, `x-ifarm-tenant-id` ou roles quando o Core está configurado.
5. `owner`, `tenant_admin` e `ifarm_admin` só recebem papel administrativo Academy com MFA satisfeito.
6. O proxy legado permanece apenas para DEV/testes até a migração do frontend protegida ser concluída.

## Fora da release

- provisionar ou alterar iFarm Core;
- configurar valores reais de STAGE;
- criar secrets;
- deploy;
- migrar todos os services frontend para Bearer;
- login/shell completo;
- seleção de tenant no frontend Academy;
- integrar notification API do Core (não foi encontrada implementação concreta no Core atual).

## Próxima versão

v0.47 — Frontend Session & Authenticated API Migration.
