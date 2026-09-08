# Changelog v0.54.0

## Added
- projeção `academy_enterprise_manager` baseada em capabilities reais do iFarm Core;
- permissions verificadas no snapshot de sessão do workspace;
- navegação empresarial condicionada à capacidade efetiva;
- documentação da ausência atual de um serviço/barramento de notificações no Core.

## Changed
- autorização empresarial diferencia administrador global de gestor empresarial tenant-scoped;
- criação de empresa permanece restrita a `academy_admin`/`ifarm_admin`;
- role `manager` isoladamente não concede privilégios empresariais.

## Security
- gestão empresarial exige `organization.manage`, `user.manage`, `notification.manage` e MFA satisfeito;
- técnico, operador, financeiro e parceiro não recebem a capacidade por padrão;
- backend continua fail-closed e autoridade final.
