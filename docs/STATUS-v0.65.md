# iFarm Academy — Status v0.65

## Curadoria editorial em todas as superfícies públicas
A v0.65 expande o motor editorial da v0.64 para detalhes de trilhas, instrutores, eventos, planos, parceiros e bundles, mantendo a mesma política de privacidade e segregação por tenant.

### Entregas
- rail editorial reutilizável e fail-soft por contexto público;
- curadoria em detalhe de trilha;
- curadoria em perfil público de instrutor;
- curadoria em detalhe de plano;
- curadoria em detalhe de parceiro;
- curadoria em detalhe de bundle;
- nova página pública de detalhe de evento em `/events/{id}`;
- itens editoriais do tipo evento passam a apontar para o detalhe do evento;
- contrato de URL de recomendações coberto por teste para todas as superfícies;
- estilo do rail desacoplado do CSS específico da Home.

### LGPD e segurança
- nenhuma superfície usa identidade do visitante;
- nenhum histórico de navegação é persistido;
- nenhuma recomendação cria lead ou oportunidade automaticamente;
- itens continuam revalidados contra tenant, publicação e White Label no backend;
- falha da curadoria não derruba a página principal.

### Infraestrutura
- nenhuma migration nova;
- nenhuma credencial nova;
- nenhum deploy;
- `main` e produção permanecem fora desta release.
