# iFarm Academy v0.32 — Validade e Expiração de Certificados

## Objetivo
Separar de forma explícita a renovação de treinamento da validade pública do certificado, preservando a política aplicada no momento da emissão sem reescrever documentos históricos.

## Entregas
- migration `0017_certificate_validity.sql`;
- política de validade por curso com versionamento;
- modos `fixed_months` e `indefinite` somente quando explicitamente configurados;
- ausência de política representada como `not_configured`, nunca como validade indefinida;
- confirmação humana obrigatória, fonte/referência e justificativa;
- histórico imutável das versões da política;
- snapshot da política gravado no certificado na emissão;
- `valid_until` calculado a partir da data de conclusão;
- tratamento correto de fim de mês e ano bissexto;
- situação pública efetiva `valid`, `expired` ou `revoked`;
- página pública atualizada com validade e versão da política;
- área do aluno exibindo validade do certificado;
- painel administrativo `Validade certificados`;
- relatório de certificados regulatórios expirados, próximos do vencimento e sem política temporal;
- fixture D1-compatible de imutabilidade e isolamento tenant;
- gate específico no CI.

## Imutabilidade
Alterar ou remover a política atual não modifica certificados já emitidos. Cada certificado preserva:
- modo de validade;
- versão aplicada;
- data limite, quando houver;
- snapshot da decisão e sua referência.

## Regra regulatória
A Academy não presume validade legal ou regulatória. Para treinamento regulamentar:
- `not_configured` significa apenas que nenhuma política temporal foi registrada no snapshot;
- `indefinite` só pode existir quando uma decisão humana explícita foi registrada;
- a política configurada não substitui a análise da norma vigente;
- renovação do treinamento e expiração do certificado permanecem conceitos independentes.

## Segurança
- configuração restrita a `academy_admin` e `ifarm_admin`;
- tenant obtido exclusivamente do identity boundary confiável;
- triggers bloqueiam política cross-tenant;
- confirmação humana obrigatória para salvar ou remover política atual;
- validação pública não expõe IDs internos nem dados de tenant.

## Governança de release
- versão: `0.32.0`;
- destino: `develop`;
- nenhum deploy nesta release;
- `main` e produção permanecem intactos;
- nenhum secret ou recurso de outro projeto é reutilizado.
