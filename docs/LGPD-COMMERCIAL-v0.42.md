# LGPD — Motor Comercial v0.42

## Princípio

O motor comercial não transforma aprendizagem em autorização de marketing. A existência de um vínculo acadêmico, progresso, nota, certificado, presença ou interesse contextual não equivale a consentimento comercial.

## Salvaguardas implementadas

- recomendação e oportunidade são entidades separadas;
- `GET` de recomendações não cria lead/oportunidade;
- opt-in exige `consent=true` e versão de consentimento atual;
- o backend revalida a elegibilidade no momento do opt-in;
- finalidade, texto, versão e timestamp são congelados na oportunidade;
- evidência de consentimento não pode ser alterada depois;
- regras ativas não podem ter o texto de consentimento modificado em silêncio;
- mudança de texto/finalidade exige nova versão;
- tenant e user são derivados do contexto autenticado;
- nenhum dado de contato pessoal é duplicado no motor;
- conversão exige referência concreta de pedido, contrato ou CRM;
- ações administrativas são auditadas.

## Dados históricos

Leads Smart Farm anteriores à v0.42 são preservados com referência ao registro legado. Quando o texto integral de consentimento não estava armazenado, ele não é reconstruído artificialmente. Esses registros usam `legacy_event_interest` e mantêm snapshots de texto/versão nulos.

## Não implementado deliberadamente

- perfilamento comercial por nota ou dificuldade;
- scoring oculto de propensão;
- lead automático criado por certificado;
- lead automático criado pelo Tutor IA;
- exportação automática para terceiros;
- disparo comercial por e-mail/WhatsApp sem uma base e preferência apropriadas;
- enriquecimento de dados pessoais por fontes externas.

## Próximas validações humanas/jurídicas

Antes da operação comercial real, definir com jurídico/DPO quando aplicável:
- textos finais de consentimento e avisos de privacidade;
- bases legais por canal e finalidade;
- retenção das oportunidades e evidências;
- processo de revogação/oposição e bloqueio de novos contatos;
- compartilhamento com parceiros e operadores;
- contrato e papéis de controlador/operador em White Label.
