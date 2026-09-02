# Fila de correção manual — contrato funcional

A interface administrativa futura deverá listar tentativas com status `manual_review` e exibir, no mínimo:

- aluno;
- curso e quiz;
- número da tentativa;
- versão da política usada;
- respostas abertas pendentes;
- pontuação máxima por questão;
- campo de nota por questão;
- observação opcional;
- revisor;
- data da revisão;
- nota automática já obtida;
- nota final calculada no servidor.

A UI não poderá calcular a nota final de forma autoritativa. Ela envia as notas manuais e recebe o resultado final do endpoint `POST /api/attempts/:id/review`.
