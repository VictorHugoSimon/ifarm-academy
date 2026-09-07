# Changelog v0.43

## Added
- outbox de handoff comercial desacoplada;
- API administrativa de criação/consulta/transição de handoffs;
- evidência imutável de conversão;
- API de evidências e valor comercial atribuído;
- métricas de funil, handoff e atribuição;
- segregação de valor por moeda;
- ações e KPIs de handoff no Motor Comercial;
- migration 0031;
- fixture dedicada de handoff, conversão, moeda e tenant isolation;
- testes do payload mínimo de integração.

## Privacy / Security
- payload de handoff não contém userId, e-mail ou telefone;
- handoff só é permitido para oportunidade qualificada ou posterior;
- `delivered` exige referência externa concreta;
- `failed` exige código de erro;
- payload da outbox é imutável;
- evidências de conversão são append-only;
- vínculos cross-tenant são bloqueados.

## Business semantics
- valor comercial atribuído não é faturamento, recebimento ou receita contábil;
- moedas diferentes não são somadas;
- nenhum envio externo é realizado nesta versão.

## Not included
- adapter real de CRM/iFarm Core;
- credenciais;
- worker automático de entrega;
- deploy.
