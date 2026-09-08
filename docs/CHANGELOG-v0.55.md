# Changelog v0.55.0

## Added
- adapter tenant-aware para `GET /api/v1/memberships` do iFarm Core;
- endpoint protegido `/api/core-memberships` para seleção de identidades empresariais;
- referência `core_membership_id` nos colaboradores da Academy;
- seletor de memberships ativas no painel empresarial;
- fixture SQLite dedicada ao vínculo Core ↔ Academy.

## Changed
- em ambiente integrado, o cadastro de colaborador exige `membershipId` validado novamente no Core;
- `userId` e nome deixam de ser autoridade fornecida pelo browser;
- e-mail permanece apenas como dado transitório de seleção e não é persistido no D1 Academy.

## Compatibility
- fluxo manual `userId/displayName` permanece apenas para DEV/testes sem `ACADEMY_CORE_API_URL`.

## Security
- somente membership ativa do tenant atual pode originar colaborador empresarial;
- diretório Core falha fechado em 401/403/indisponibilidade;
- nenhuma membership, role, usuário ou tenant informado pelo navegador é confiado em ambiente integrado.
