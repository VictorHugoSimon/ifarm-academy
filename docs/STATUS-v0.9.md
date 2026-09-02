# iFarm Academy — Status v0.9

## Objetivo desta versão
Transformar o conjunto funcional v0.6-v0.8 em uma aplicação React/Vite executável, mantendo o Layout Master como referência visual e sem tocar produção.

## Implementado
- package.json com React 19, TypeScript e Vite;
- index.html e entrypoint src/main.tsx;
- configuração TypeScript estrita;
- configuração Vite;
- carregamento do Academy Workspace como aplicação;
- composição dos estilos Course Builder, Quiz/Player e Assessment/Certificate;
- runtime.css para o shell integrado seguindo a linguagem visual aprovada;
- .gitignore para proteger artefatos e credenciais locais;
- .env.example sem valores sensíveis e com boundary explícito entre frontend e server-side.

## Base funcional já presente
- Course Builder;
- Quiz Builder;
- Student Player;
- tentativa de avaliação;
- correção automática;
- revisão manual;
- elegibilidade e emissão local de certificado.

## Segurança e governança
- branch feature/runtime-bootstrap-v0.9;
- main/produção não alteradas;
- nenhum secret real versionado;
- nenhum banco/token/recurso de outro projeto reutilizado;
- CNAE permanece TBD;
- regras fiscais permanecem TBD;
- comissão marketplace permanece TBD.

## Observação de integração
A branch v0.9 parte do HEAD da v0.8 para acumular o trabalho sem depender do merge do PR #2. A promoção continua apontando apenas para develop.

## Próxima prioridade
1. migrar repositórios locais de tentativas/progresso/certificados para contratos de API;
2. criar Pages Functions e schema D1 de STAGE sem provisionar recursos reais;
3. adicionar testes executáveis do fluxo acadêmico;
4. preparar pipeline de CI sem deploy de produção.
