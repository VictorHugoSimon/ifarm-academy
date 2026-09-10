# RELEASE v0.62 — Busca Pública Unificada

## Objetivo
Transformar o portal da iFarm Academy em uma superfície de descoberta única para conteúdo, especialistas, experiências e ofertas já publicadas, sem introduzir rastreamento comportamental nem gerar lead automaticamente.

## Superfície
- `/search?q=...`
- cursos;
- trilhas públicas;
- instrutores públicos;
- eventos futuros;
- planos públicos.

## Relevância
A ordenação é explicável e determinística: correspondência exata/inicial/parcial em título, descrição e metadados públicos, seguida por destaque editorial. Não usa histórico do visitante, cookies de comportamento, score pessoal ou dados do Motor Comercial.

## White Label e tenant
O tenant é resolvido pelo host com o boundary público existente. Cursos e trilhas continuam sujeitos ao catálogo White Label. Entidades de outro tenant nunca entram no conjunto candidato.

## Segurança e LGPD
Busca é read-only. Nenhuma consulta cria matrícula, progresso, oportunidade, consentimento, perfil ou evento de marketing. Dados privados de instrutores e URLs privadas de eventos não entram no índice em memória.

## Schema
Nenhuma migration nova; total permanece em 37.

## Gate
Merge somente após `npm ci`, typecheck, testes, 37 migrations, todas as fixtures existentes, fixture nova de busca pública, contratos STAGE/deploy e build verdes.
