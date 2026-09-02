# Segurança — v0.13

## Fronteiras preservadas
- nenhum deploy para produção;
- nenhuma credencial adicionada ao repositório;
- nenhum binding Cloudflare real configurado;
- nenhum banco, token ou recurso de outros projetos reutilizado;
- `main` permanece fora da linha de desenvolvimento da v0.13.

## Identidade administrativa
Os endpoints de revisão e publicação registram `reviewerId`/`actorId` para auditoria, porém a autoridade desses IDs ainda dependerá da futura integração com a autenticação/RBAC do iFarm Core.

Consequência: esses endpoints não devem ser considerados prontos para exposição administrativa em produção até existir middleware de identidade e autorização.

## Integridade da avaliação
- gabarito e regra de nota permanecem server-side;
- versão da política é registrada na submissão;
- revisão manual usa a política versionada correspondente;
- nota manual respeita limite de pontos por questão;
- revisão parcial é rejeitada;
- auditoria por questão é persistida separadamente.

## Pendências antes de STAGE público
- integrar identidade iFarm Core;
- RBAC para administrador/revisor;
- testes de Functions com D1 isolado;
- rate limiting para endpoints sensíveis;
- estratégia de logs/auditoria operacional;
- política de retenção LGPD.
