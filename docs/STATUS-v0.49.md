# STATUS — iFarm Academy v0.49

## Objetivo
Expandir o transporte HTTP autenticado explícito para os módulos protegidos restantes de menor/médio porte e corrigir o check-in Smart Farm para usar a sessão real do iFarm Core.

## Services migrados para Bearer explícito
- `eventApi.ts`;
- `gamificationApi.ts`;
- `instructorApi.ts`;
- `marketplaceApi.ts`;
- `notificationApi.ts`;
- `plansApi.ts`;
- `reportApi.ts`;
- `whiteLabelApi.ts`;
- `certificateValidityApi.ts`;
- `publicPortalAdminApi.ts`;
- `mediaApi.ts`;
- `apiPersistence.ts`;
- `materialApi.ts` para reserva e upload same-origin;
- `certificateApi.ts` apenas para certificados privados;
- `operationsApi.ts` apenas para operações administrativas;
- `smartFarmApi.ts` para agenda, QR, evidências e interesses autenticados.

## Fronteiras públicas preservadas
- validação pública de certificado continua sem Bearer;
- `/api/health` e `/api/readiness` continuam públicos;
- upload para URL externa assinada continua sem Authorization da Academy;
- portal público continua fora do transporte autenticado do workspace.

## Correção Smart Farm
`/smart-farm/checkin` agora passa pelo `AcademySessionGate`. O token QR sozinho não identifica o usuário e não registra presença sem sessão Neon/iFarm Core válida.

## Estado residual
`enterpriseApi.ts` e `commercialApi.ts` permanecem no transporte de compatibilidade da v0.47 e serão migrados na v0.50. O interceptor global do `/app` permanece ativo até esses dois domínios serem concluídos e validados.

## Segurança
- tenant continua sendo definido exclusivamente pelo iFarm Core;
- nenhuma credencial foi adicionada ao repositório;
- nenhum endpoint público foi convertido inadvertidamente em privado;
- nenhum Bearer é enviado para URL externa de upload.
