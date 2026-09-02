# iFarm Academy — API de Avaliação v0.12

A v0.12 move criação, limite e correção da tentativa para o backend. O navegador deixa de ser autoridade sobre número de tentativas, gabarito, nota mínima e aprovação.

## Política da avaliação

Persistida em `academy_quiz_policies`:
- `quiz_id`;
- `course_id`;
- status `draft | published | archived`;
- nota mínima;
- limite de tentativas;
- configuração de embaralhamento;
- snapshot server-side das questões e gabarito;
- versão da política.

## Criar tentativa

`POST /api/attempts`

```json
{
  "quizId": "quiz-123",
  "studentId": "user-456"
}
```

O backend verifica política publicada, conta tentativas anteriores e gera `attemptNumber` de forma autoritativa.

## Submeter tentativa

`POST /api/attempts/:id/submit`

```json
{
  "answers": [
    { "questionId": "q1", "optionIds": ["a"] },
    { "questionId": "q2", "answerText": "Resposta aberta" }
  ]
}
```

A Function carrega o snapshot server-side das questões, corrige questões automáticas e define:
- `approved`;
- `failed`;
- `manual_review`.

A nota final fica `null` quando existir correção manual pendente.

## Validação pública do certificado

`GET /api/certificates/public/:code`

Retorna somente dados públicos necessários à validação: código, aluno, curso, nota final, emissão e status. IDs internos não são expostos.

## Segurança

Esta camada ainda não considera `studentId` enviado pelo navegador como prova de identidade. Quando o contrato de autenticação do iFarm Core estiver disponível, o backend deverá derivar identidade e tenant da sessão autenticada.
