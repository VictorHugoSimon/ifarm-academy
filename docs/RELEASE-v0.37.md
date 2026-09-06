# iFarm Academy v0.37 — Gamification Foundation

## Objetivo
Adicionar uma camada motivacional configurável e auditável sem permitir que gamificação interfira em nota, progresso, certificado ou compliance.

## Entregas
- migration `0022_gamification.sql`;
- regras de XP versionadas por tenant e evento;
- nenhum valor padrão de XP hardcoded;
- ledger idempotente de pontos;
- níveis configuráveis por faixa de XP;
- badges por XP total ou contagem de eventos;
- concessão idempotente de badges;
- streak diário com sequência atual e melhor sequência;
- perfil do aluno com XP, nível, badges, streak e atividade recente;
- painel administrativo de regras, badges e níveis;
- integração com aula concluída, curso concluído e certificado emitido;
- gamificação em modo fail-open: falha do módulo não bloqueia aprendizagem;
- isolamento por tenant;
- fixture D1-compatible;
- gate específico no CI.

## Regras de governança
- XP nunca altera nota, status de aprovação, carga horária, validade ou elegibilidade de certificado.
- Sem regra ativa para um evento, nenhum ponto é concedido.
- Uma mesma fonte/evento/usuário não pode pontuar duas vezes.
- Alterar regra de XP cria uma nova versão e aposenta a anterior.
- Streak usa data UTC no backend para comportamento determinístico; apresentação local pode ser evoluída depois.
- Ranking público, desafios e metas não fazem parte desta release.

## Eventos preparados
- `lesson_completed`
- `course_completed`
- `quiz_approved`
- `certificate_issued`
- `event_attended`
- `smart_farm_activity`

## Limites intencionais
Ranking, desafios, metas, campanhas de gamificação, recompensas comerciais e automações avançadas ficam para versões posteriores. Nenhum benefício financeiro é associado a XP nesta release.

## Infraestrutura
Nenhum deploy, secret ou recurso de produção foi criado. Destino exclusivo: `develop`.
