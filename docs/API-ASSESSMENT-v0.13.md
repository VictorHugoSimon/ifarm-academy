# API de Avaliação — v0.13

## Submeter tentativa
`POST /api/attempts/:id/submit`

O backend usa a política publicada, calcula a parte automática, registra `policyVersion` e decide entre `approved`, `failed` ou `manual_review`.

## Revisão manual
`POST /api/attempts/:id/review`

Payload mínimo:
```json
{
  "reviewerId": "user-core-id",
  "reviewerName": "Nome do revisor",
  "reviewNote": "Observação geral opcional",
  "reviews": [
    {
      "questionId": "q-open-1",
      "awardedPoints": 4,
      "note": "Critérios atendidos"
    }
  ]
}
```

Regras:
- a tentativa precisa estar em `manual_review`;
- todas as questões pendentes precisam ser corrigidas;
- uma questão não pode aparecer duas vezes;
- a nota não pode ser negativa nem superar o máximo da questão;
- a nota final é calculada no backend;
- cada correção é registrada em `academy_quiz_attempt_reviews`.

## Consultar políticas
`GET /api/quiz-policies?quizId=<id>`

Retorna política atual e histórico publicado.

## Publicar nova política
`POST /api/quiz-policies`

Payload:
```json
{
  "quizId": "quiz-1",
  "courseId": "course-1",
  "actorId": "admin-core-id",
  "minimumScore": 70,
  "attemptsAllowed": 3,
  "randomizeQuestions": true,
  "questions": []
}
```

Cada publicação gera uma nova versão imutável no histórico e atualiza a política corrente usada para novas submissões.

## Autorização
A identidade definitiva de `reviewerId` e `actorId` deverá ser injetada/validada pela autenticação do iFarm Core. Até essa integração, estes endpoints não devem ser expostos como administrativos em produção.
