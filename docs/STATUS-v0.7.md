# iFarm Academy — Status v0.7

## Entrega desta versão

A v0.7 implementa a próxima camada prioritária do MVP sem depender de infraestrutura externa: **Quiz Builder + Student Player**.

### Quiz Builder
- modelo de domínio para avaliações, perguntas e alternativas;
- tipos de questão: múltipla escolha, verdadeiro/falso e resposta aberta;
- configuração de nota mínima;
- limite de tentativas;
- embaralhamento de perguntas;
- resultado imediato configurável;
- criação e exclusão de perguntas;
- edição de enunciado e pontuação;
- definição de alternativa correta;
- resposta aberta direcionada para correção manual;
- persistência local para validação antes do D1;
- publicação/retorno para rascunho.

### Student Player
- player acadêmico com estrutura de curso/aula;
- navegação entre aulas;
- progresso por aula;
- progresso consolidado do curso;
- marcação de conclusão;
- continuidade automática para próxima aula;
- suporte visual a vídeo, texto e avaliação;
- área de materiais e anotações preparada;
- persistência local do progresso;
- boundary explícito para futuro provedor de streaming.

### Regras acadêmicas
- serviço de correção automática de quiz;
- combinação exata de alternativas corretas;
- resposta aberta sinaliza revisão manual;
- nota percentual calculada apenas sobre questões automáticas;
- aprovação automática bloqueada enquanto existir revisão manual;
- regra de tentativas respeita publicação e quantidade máxima.

## Git

Desenvolvimento realizado em:

`feature/quiz-player-v0.7`

Base:

`develop`

Nenhuma alteração foi realizada diretamente em `main` ou produção.

## Segurança e decisões preservadas
- nenhum secret adicionado;
- nenhum banco ou token de outro projeto utilizado;
- CNAE continua TBD;
- regras fiscais continuam TBD;
- percentual de comissão do marketplace continua TBD;
- streaming continua desacoplado até definição do provedor;
- autenticação continuará integrada ao iFarm Core quando o contrato técnico estiver disponível.

## Próxima prioridade

1. integrar Course Builder + Quiz Builder + Student Player em um shell único;
2. implementar tentativa real de avaliação no player;
3. implementar tela de resultado/revisão manual;
4. criar fluxo de emissão/validação de certificado condicionado a progresso e nota;
5. adicionar testes automatizados das regras acadêmicas.
