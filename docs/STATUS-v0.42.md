# iFarm Academy — Status v0.42

## Escopo

A v0.42 implementa o Motor Comercial consentido da Academy, conectando contexto educacional a oportunidades do ecossistema iFarm sem criar leads automaticamente.

## Entregue

- regras comerciais multi-tenant por origem acadêmica;
- origens: conclusão de curso, certificado, evento, trilha e plano;
- referências de oferta para iFarm Core, Store, Services, Finance, Insurance, Academy, parceiro ou outro sistema;
- recomendações somente leitura;
- opt-in explícito obrigatório antes da criação de oportunidade;
- snapshot imutável da finalidade, texto e versão do consentimento;
- pipeline canônico `new → qualified → contacted → opportunity → converted/discarded`;
- referência obrigatória para conversão;
- atribuição de responsável comercial;
- auditoria das mudanças administrativas;
- migração de leads históricos da Smart Farm Experience sem inventar texto de consentimento retroativo;
- compatibilidade das APIs Smart Farm existentes;
- painel administrativo Motor Comercial;
- recomendações pós-certificação na área do aluno;
- fixtures de isolamento, consentimento, imutabilidade e legado;
- migrations 0028–0030;
- versão da aplicação 0.42.0.

## Regras críticas

1. Conclusão, certificado, presença, trilha ou plano não geram oportunidade comercial automaticamente.
2. Uma oportunidade nova exige ação explícita do usuário.
3. A versão de consentimento enviada pelo cliente deve coincidir com a regra ativa no servidor.
4. Uma regra ativa é imutável; alterações comerciais ou de consentimento exigem arquivamento e nova versão.
5. Evidência de consentimento e snapshot da oferta são imutáveis na oportunidade.
6. O tenant vem do contexto autenticado, nunca do browser como autoridade.
7. A Academy referencia produtos/serviços externos; não replica catálogo, estoque, contrato ou CRM.

## Fora desta versão

- envio automático para CRM externo;
- automação de WhatsApp/e-mail comercial;
- scoring comportamental oculto;
- criação automática de lead por IA;
- checkout/assinatura financeira;
- credenciais de Mercado Pago;
- deploy STAGE ou PRODUCTION.

## Próximo bloco sugerido

v0.43: integração de handoff comercial por interface/evento de domínio, métricas de conversão, origem de receita e preparação para CRM/iFarm Core sem acoplamento direto.
