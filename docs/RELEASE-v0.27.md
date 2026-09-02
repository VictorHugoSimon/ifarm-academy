# iFarm Academy v0.27 — Trilhas empresariais e governança de renovação

## Entrega
- Trilhas de aprendizagem específicas por empresa e tenant.
- Trilhas compostas somente por cursos publicados.
- Ordem e obrigatoriedade por curso na trilha.
- Periodicidade padrão opcional da trilha e override por curso no modelo/API.
- Atribuição de trilha a colaborador com prazo próprio.
- Conciliação automática com matrículas e atribuições já existentes.
- Prazo mais restritivo preservado quando um curso já possui atribuição aberta.
- Conclusões anteriores nunca são reabertas pela atribuição de uma trilha.
- Trilha pode ser concluída imediatamente quando todos os cursos obrigatórios já estavam concluídos.
- Progresso agregado da trilha derivado dos cursos obrigatórios.
- Detecção de trilha em atraso.
- Inativação de trilha preservando histórico.
- Monitor de renovações vencidas, próximas (30 dias) e futuras.
- Certificado anterior continua acessível na governança de renovação.
- Nova aba `Trilhas empresariais` integrada ao workspace.

## Renovação e compliance
- A Academy **não infere periodicidade de NR-31 ou de qualquer outra norma**.
- `renewal_months` só existe quando configurado explicitamente pela operação responsável.
- Datas de renovação usam soma de meses com clamp de fim de mês (ex.: 31/jan + 1 mês → 28/29 fev).
- Uma política nova pode começar a monitorar uma conclusão histórica sem alterar progresso, prova, certificado ou data de conclusão.
- A v0.27 é uma camada de governança/monitoramento; ela não reinicia automaticamente um treinamento concluído.

## Persistência
Migration `0013_enterprise_paths_renewals.sql` adiciona:
- `academy_company_learning_paths`;
- `academy_company_learning_path_courses`;
- `academy_company_path_assignments`;
- `academy_company_path_assignment_courses`;
- metadados `renewal_months`, `renewal_of_assignment_id` e `renewal_cycle` nas atribuições de curso;
- índices e triggers de integridade multi-tenant.

A unicidade de atribuição de curso passa a bloquear apenas ciclos **abertos** (`assigned` / `in_progress`), permitindo múltiplos ciclos concluídos no histórico.

## APIs
- `GET/POST/DELETE /api/company-learning-paths`
- `GET/POST /api/company-path-assignments`
- `GET /api/company-renewals`

## Testes e CI
- Testes unitários da regra de renovação.
- Fixture `integration_enterprise_paths_contract.py` para trilha, histórico de ciclos, unicidade de ciclo aberto e isolamento tenant.
- Novo gate `Enterprise paths and renewals fixtures` no CI.

## Limite intencional
O modelo atual de matrícula/progresso/quiz ainda é centrado em `student + course`. Portanto a Academy **não deve** criar automaticamente um novo treinamento recorrente reaproveitando progresso antigo. A próxima camada deve introduzir um identificador de ciclo acadêmico/treinamento e propagá-lo de modo auditável para progresso, avaliação e novo certificado.
