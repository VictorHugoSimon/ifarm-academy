# iFarm Academy — Status v0.67

## Performance & Acessibilidade Foundation
A v0.67 reduz o custo inicial de carregamento separando as principais superfícies em chunks lazy e adiciona proteções globais de navegação por teclado e preferência de movimento reduzido.

### Entregas
- `React.lazy`/`Suspense` para workspace, portal e superfícies públicas;
- fallback de carregamento com `role=status` e `aria-live`;
- botão global “Pular para o conteúdo”;
- foco visível consistente;
- `prefers-reduced-motion` respeitado globalmente;
- estilos de sessão movidos para o chunk autenticado;
- contrato estático de performance/acessibilidade no CI.

### Segurança e arquitetura
- nenhuma regra acadêmica/comercial alterada;
- nenhuma migration;
- nenhuma credencial nova;
- code-splitting não altera identidade, tenant ou autorização.

### Infraestrutura
- `main` e produção permanecem intactos nesta release;
- merge somente após CI completo.
