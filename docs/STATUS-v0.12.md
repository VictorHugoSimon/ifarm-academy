# iFarm Academy — Status v0.12

## Entrega
Avaliação server-side ampliada sem provisionar infraestrutura e sem qualquer deploy de produção.

## Implementado
- criação de tentativa no backend;
- limite de tentativas aplicado pela política server-side;
- numeração de tentativa gerada no backend;
- política versionada da avaliação em D1;
- snapshot server-side de questões/gabarito;
- submissão da tentativa em endpoint próprio;
- correção automática no backend;
- resposta aberta encaminhada para `manual_review`;
- aprovação/reprovação automática pela nota mínima;
- teste formal do motor de correção server-side;
- validação pública de certificado por código;
- versão da aplicação atualizada para 0.12.0.

## Decisão técnica
O browser não decide mais limite, número da tentativa, gabarito, nota ou status final da avaliação. Esses valores passam a depender da política persistida no backend.

## Segurança e governança
- branch recriada sobre o `develop` atualizado após o merge da v0.11;
- destino de promoção continua sendo `develop`;
- `main` e produção não alteradas;
- nenhum secret/binding real criado;
- nenhum banco, token ou recurso de outro projeto reutilizado;
- identidade definitiva continua reservada à integração com o iFarm Core;
- CNAE, regras fiscais e comissão de marketplace permanecem TBD;
- Layout Master preservado.

## Próxima prioridade
- correção manual via endpoint dedicado, com auditoria;
- endpoint administrativo para publicar/versionar política de quiz;
- testes de Functions com D1 isolado;
- lockfile e troca do CI para `npm ci`;
- integrar o frontend ao adapter HTTP quando o ambiente STAGE estiver disponível.
