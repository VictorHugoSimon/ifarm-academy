# iFarm Academy v0.24 — Certificado público e QR Code

## Entrega
- Snapshot acadêmico imutável por certificado.
- Carga horária calculada no momento da emissão.
- Instrutor ou responsável preservado no certificado.
- Tipo de certificado preservado no snapshot.
- Data de conclusão preservada separadamente da data de emissão.
- API pública de validação ampliada.
- Página pública `/certificates/validate?code=...` sem login.
- QR Code gerado localmente pela aplicação.
- Aba do aluno conectada ao endpoint `my-certificates`.
- Course Builder passou a cadastrar responsável e tipo de certificado.
- Readiness de publicação bloqueia curso sem metadados mínimos de certificação.

## Tipos preparados
- `free_course`
- `corporate_training`
- `regulatory_training`
- `partner_certification`

A classificação `regulatory_training` não substitui a matriz de conformidade da norma aplicável. Os requisitos específicos continuam sendo validados por treinamento.

## Segurança
- A validação pública não expõe `student_id`, tenant ou dados internos de auditoria.
- O QR aponta somente para a página pública de validação.
- O certificado usa código público único.
- Documentos revogados continuam localizáveis, porém são apresentados como sem validade ativa.
- Nenhum serviço externo de QR Code é utilizado.

## Infraestrutura
Nenhum deploy e nenhum recurso externo foram provisionados nesta versão. `main` e produção permanecem intactos.
