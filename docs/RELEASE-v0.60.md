# RELEASE v0.60 — Tutor Learning Tools

## Objetivo
Transformar o conteúdo autorizado do Tutor em materiais de estudo úteis sem transformar IA em autoridade de avaliação acadêmica.

## Funcionalidades
- resumo grounded por curso;
- flashcards grounded com resposta e fonte;
- exercícios de prática com referência de estudo;
- foco opcional para priorizar um assunto;
- citações rastreáveis para cada item;
- interface integrada ao AI Tutor.

## Garantias
- `evidence_only` permanente nesta release;
- nenhuma chamada a provider externo pelos Learning Tools;
- sem escrita de nota, tentativa, progresso, conclusão ou certificado;
- sem fonte autorizada suficiente, não há geração;
- artefatos com citações inválidas são rejeitados server-side;
- matrícula, tenant, publicação e autorização do Tutor são verificadas no backend.

## Dados e migrations
Nenhuma migration nova. A release continua sobre as 37 migrations existentes da v0.59.

## Deploy
Esta release não promove `main` nem produção. Segue o fluxo feature branch → PR → `develop`, condicionado ao CI integralmente verde.
