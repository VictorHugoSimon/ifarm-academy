# iFarm Academy v0.31 — Relatórios e Indicadores do MVP

## Objetivo
Transformar os dados operacionais já existentes na Academy em relatórios executivos e operacionais sem apresentar dados demonstrativos como se fossem reais.

## Entregas
- endpoint consolidado `/api/reports` tenant-aware;
- filtro de período com janela padrão de 30 dias e limite de 366 dias;
- visão acadêmica;
- visão empresarial;
- visão de eventos e Smart Farm Experience;
- visão de governança técnica para treinamentos regulatórios;
- exportação CSV por bloco;
- tela `Relatórios` integrada ao workspace;
- testes das regras de período e CSV;
- fixture D1-compatible de relatórios;
- gate específico no CI.

## Indicadores acadêmicos
- cursos publicados;
- alunos únicos;
- ciclos ativos;
- matrículas no período;
- conclusões no período;
- certificados no período;
- taxa de aprovação em avaliações;
- nota média;
- desempenho por curso.

## Indicadores empresariais
- empresas ativas;
- colaboradores ativos;
- atribuições abertas;
- atribuições atrasadas;
- conclusões no período;
- taxa acumulada de conclusão;
- renovações vencidas e próximas;
- desempenho por empresa e trilhas.

## Indicadores de eventos
- próximos eventos;
- próximos Smart Farm Experience;
- inscrições no período;
- lista de espera atual;
- taxa de presença em eventos encerrados;
- presenças e ausências;
- ocupação por evento.

## Governança técnica
A seção de treinamentos regulatórios mede cobertura de governança técnica e não declara conformidade legal automática.

Indicadores:
- cursos marcados como `regulatory_training`;
- cursos regulatórios publicados sem responsável técnico vigente;
- qualificações verificadas vigentes;
- qualificações com vencimento em até 30 dias;
- qualificações vencidas;
- responsabilidades técnicas ativas com qualificação verificada;
- certificados regulatórios emitidos no período.

## Segurança e segregação
- acesso administrativo restrito a `academy_admin` e `ifarm_admin`;
- todas as consultas filtram `tenant_id` do identity boundary confiável;
- nenhum parâmetro do browser define o tenant;
- CSV é gerado a partir do resultado já segregado recebido pela UI.

## Governança de release
- versão: `0.31.0`;
- destino: `develop`;
- nenhum deploy nesta release;
- `main` e produção permanecem intactos;
- nenhuma credencial ou recurso de outro projeto é reutilizado.
