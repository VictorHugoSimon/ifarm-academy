# iFarm Academy — Status v0.10

## Entrega
Persistência desacoplada preparada para migração de localStorage para API + Cloudflare D1.

## Implementado
- interfaces `ProgressRepository`, `AttemptRepository` e `CertificateRepository`;
- composição `AcademyPersistence`;
- adapter HTTP sem credenciais embutidas;
- contrato de endpoints para progresso, tentativas e certificados;
- migration D1 para estado acadêmico;
- constraints de percentual, status, unicidade de tentativas e código público;
- índices de consulta;
- regra documentada de emissão idempotente de certificado;
- regra de segurança: elegibilidade deve ser recalculada no backend.

## Preservado
- Layout Master e frontend v0.9 sem alterações visuais nesta camada;
- produção não alterada;
- nenhum secret, token, banco ou recurso de outro projeto;
- CNAE TBD;
- regras fiscais TBD;
- comissão marketplace TBD.

## Próxima camada
Implementar Pages Functions/Workers contra estes contratos, testes automatizados do domínio e CI de typecheck/build/test sem deploy de produção.
