# iFarm Academy v0.26 — Área Empresarial

## Entrega
- Cadastro tenant-aware de empresas.
- Cadastro de colaboradores vinculado ao `userId` do ecossistema iFarm.
- Atribuição de cursos publicados por colaborador.
- Definição de obrigatoriedade e prazo.
- Matrícula criada ou conciliada automaticamente na atribuição.
- Conclusões anteriores são preservadas.
- Cancelamento de atribuição não cancela automaticamente a matrícula.
- Status derivado de progresso real: atribuído, em andamento, concluído ou cancelado.
- Identificação de treinamentos em atraso.
- Resumo por empresa: colaboradores, atribuições, conclusão, atraso e certificados.
- Acesso direto à validação pública do certificado.
- Aba `Área empresarial` integrada ao workspace.

## Segurança
- Empresas, membros e atribuições possuem `tenant_id`.
- Triggers bloqueiam vínculo company/member/course entre tenants.
- `academy_admin` e `ifarm_admin` podem administrar as empresas do tenant.
- `company_admin` e `academy_company_admin` exigem `x-ifarm-company-id` injetado pelo proxy confiável.
- Gestor empresarial não consegue consultar ou alterar outra empresa do mesmo tenant.
- Criação de novas empresas permanece restrita aos administradores globais Academy/iFarm.

## Testes
- Migration `0012_enterprise_training.sql` entra no gate sequencial de migrations.
- Fixture `integration_enterprise_contract.py` valida empresa, colaborador, atribuição, isolamento entre tenants e unicidade de atribuição ativa.
- Testes unitários validam o escopo fail-closed de empresa.

## Limites desta versão
- Trilhas empresariais ficam para a próxima camada.
- Renovação/peridiocidade de treinamentos ainda não foi implementada.
- O escopo `x-ifarm-company-id` é um contrato preparado; a origem definitiva será o RBAC/sessão do iFarm Core.
- Nenhum deploy ou recurso Cloudflare foi provisionado.
