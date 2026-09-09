# STATUS — iFarm Academy v0.59

## Escopo
Quotas operacionais e guardrails do AI Tutor para controlar uso do provider externo sem transformar custo/token em número presumido e sem enfraquecer o fallback `evidence_only`.

## Entregue
- migration `0037_tutor_usage_guardrails.sql`;
- políticas versionadas de uso por tenant, curso ou aluno;
- janelas `day` e `month` em UTC;
- limites opcionais por número de chamadas e/ou caracteres de entrada;
- nenhuma quota padrão criada automaticamente;
- geração externa exige política ativa de tenant;
- reservas de quota com TTL antes da chamada externa para evitar estouro por concorrência;
- provider event real exige reserva consumida correspondente;
- políticas são imutáveis e somente podem ser arquivadas/substituídas por nova versão;
- detecção conservadora de tentativas de override, exfiltração de prompt/segredo, role override e instruções maliciosas em fontes;
- prompt risk bloqueia somente o provider e mantém `evidence_only`;
- eventos de guardrail append-only armazenam apenas códigos/flags e métricas, nunca o texto bruto da pergunta;
- painel administrativo com tentativas, sucesso, latência, caracteres, quota blocks, prompt risks, outcomes e consumo das políticas;
- governança administrativa para publicar/arquivar quotas;
- fixture específica e novo gate no CI;
- fixture v0.58 adaptada ao novo requisito de reserva.

## Semântica de orçamento
`max_request_chars` controla volume de entrada enviado ao gateway e `max_provider_requests` controla tentativas externas. Nenhum desses números equivale a tokens, reais, dólares ou custo contábil. Métricas financeiras só podem ser adicionadas quando o fornecedor homologado expuser medição de cobrança confiável.

## Segurança
- ausência de política de tenant bloqueia geração externa;
- limite excedido bloqueia antes do transporte externo;
- risco de prompt bloqueia antes do transporte externo;
- bloqueio nunca impede o aluno de receber evidências autorizadas disponíveis;
- histórico de políticas e guardrails é imutável;
- nenhum segredo/token real foi versionado;
- provider continua opcional e desligado por padrão.

## Fora do escopo
- preço/custo do provider;
- token budget estimado;
- cobrança ou chargeback por tenant;
- provider específico ativado em produção;
- alteração no iFarm Core.

## Próximo bloco sugerido
v0.60 — ferramentas de estudo grounded: resumos, flashcards e exercícios derivados exclusivamente das fontes autorizadas, com contrato de saída validado, rastreabilidade de fontes e sem alterar nota/certificação automaticamente.
