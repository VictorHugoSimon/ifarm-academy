# Test Matrix — v0.41

- TypeScript: obrigatório.
- Unit tests: validators de plano, preço e benefícios.
- Migration validation: todas as migrations 0001–0027.
- Fixture D1-compatible:
  - plano pago sem preço não publica;
  - preço versionado é imutável;
  - uma versão ativa por intervalo;
  - free não aceita preço;
  - cross-tenant bloqueado;
  - plano público rejeita curso oculto;
  - assinatura paga ativa exige provedor;
  - assinatura gratuita exige referência explícita;
  - White Label filtra cursos do plano;
  - benefício público não exige exposição de external_ref.
- Build Vite: obrigatório.
