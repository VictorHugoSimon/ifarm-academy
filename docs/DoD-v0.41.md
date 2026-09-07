# DoD v0.41

A versão só pode ser mergeada em `develop` quando:
- TypeScript passa;
- testes unitários passam;
- migrations 0001–0027 aplicam em sequência;
- fixture de planos/assinaturas passa;
- fixtures anteriores continuam verdes;
- build passa;
- nenhum secret/credencial foi incluído;
- nenhum deploy foi executado;
- checkout e ativação de assinatura continuam bloqueados;
- `main` permanece intacto.
