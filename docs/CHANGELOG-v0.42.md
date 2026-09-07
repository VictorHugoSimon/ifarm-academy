# Changelog v0.42

## Added
- Motor Comercial multi-tenant.
- Regras versionadas de recomendação.
- Recomendações acadêmicas somente leitura.
- Opt-in explícito com snapshot de consentimento.
- Pipeline administrativo de oportunidades.
- Integração de ofertas pós-certificação.
- Migração de leads históricos Smart Farm para oportunidade canônica.
- Migrations 0028, 0029 e 0030.
- Fixture de integração comercial/LGPD no CI.

## Changed
- `event-interest` passa a registrar também oportunidade canônica para novos opt-ins Smart Farm.
- `event-leads` permanece compatível e sincronizado com o pipeline canônico.
- Workspace administrativo passa a incluir a área Motor Comercial.

## Security / Privacy
- tenant e usuário derivados do identity boundary;
- versão do consentimento revalidada server-side;
- regras ativas, evidência de consentimento e snapshots de oferta imutáveis;
- conclusão acadêmica isoladamente não cria lead.

## Not included
- deploy;
- CRM externo;
- disparo automático de marketing;
- scoring comportamental;
- credenciais de pagamento ou comunicação.
