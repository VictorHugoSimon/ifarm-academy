# Definition of Done — v0.13

A entrega v0.13 pode ser considerada pronta para merge em `develop` quando:

- [x] revisão manual ocorre no backend;
- [x] notas manuais respeitam máximo por questão;
- [x] revisão parcial é rejeitada;
- [x] nota final combina automático + manual;
- [x] resultado final é aprovado/reprovado server-side;
- [x] auditoria por questão é persistida;
- [x] política da tentativa é versionada;
- [x] histórico de políticas publicadas existe;
- [x] endpoint administrativo de publicação foi criado;
- [x] testes unitários das regras manuais foram adicionados;
- [x] documentação de segurança foi atualizada;
- [ ] CI do PR deve ficar verde;
- [ ] nenhuma alteração deve atingir `main` ou produção.

A integração de identidade iFarm Core é pré-requisito para exposição administrativa em STAGE público, não para merge desta camada interna em `develop`.
