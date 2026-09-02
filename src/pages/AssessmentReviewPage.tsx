import { useMemo, useState } from 'react'
import { applyManualReview } from '../application/assessmentService'
import { loadQuiz } from '../services/quizRepository'
import { loadAttempts, saveAttempt } from '../services/quizAttemptRepository'
import '../styles/assessment-cert.css'

const STUDENT_ID = 'DEMO-STUDENT-001'

export function AssessmentReviewPage() {
  const quiz = useMemo(() => loadQuiz(), [])
  const [attempts, setAttempts] = useState(() => loadAttempts(quiz.id, STUDENT_ID))
  const pending = attempts.filter((item) => item.status === 'manual_review')

  function review(attemptId: string) {
    const attempt = attempts.find((item) => item.id === attemptId)
    if (!attempt) return

    const openQuestions = quiz.questions.filter((question) => question.type === 'open_answer')
    const manualTotalPoints = openQuestions.reduce((sum, question) => sum + question.points, 0)
    const pointsInput = window.prompt(`Pontuação manual de 0 a ${manualTotalPoints}`, String(manualTotalPoints))
    if (pointsInput == null) return
    const reviewer = window.prompt('Responsável pela revisão', 'Responsável técnico') ?? 'Responsável técnico'
    const note = window.prompt('Observação da revisão', 'Resposta avaliada conforme critérios do treinamento.') ?? ''

    const reviewed = applyManualReview(
      quiz,
      attempt,
      Number(pointsInput),
      manualTotalPoints,
      reviewer,
      note,
    )
    saveAttempt(reviewed)
    setAttempts(loadAttempts(quiz.id, STUDENT_ID))
  }

  return (
    <div className="reviewPage">
      <div className="pageHeader">
        <div>
          <h1>Revisão de avaliações</h1>
          <p>Correção manual de respostas abertas e consolidação da nota final.</p>
        </div>
      </div>

      <div className="reviewList">
        {pending.length === 0 && (
          <div className="reviewCard">
            <strong>Nenhuma avaliação aguardando revisão.</strong>
            <p>Quando uma tentativa tiver resposta aberta, ela será direcionada para esta fila.</p>
          </div>
        )}

        {pending.map((attempt) => {
          const openAnswers = quiz.questions
            .filter((question) => question.type === 'open_answer')
            .map((question) => ({
              question,
              answer: attempt.answers.find((item) => item.questionId === question.id)?.answerText ?? '',
            }))

          return (
            <article className="reviewCard" key={attempt.id}>
              <div className="reviewCardHead">
                <div>
                  <small>Tentativa {attempt.attemptNumber}</small>
                  <h3>{quiz.title}</h3>
                </div>
                <span>Aguardando revisão</span>
              </div>

              {openAnswers.map(({ question, answer }) => (
                <div className="reviewAnswer" key={question.id}>
                  <strong>{question.prompt}</strong>
                  <p>{answer || 'Sem resposta.'}</p>
                  <small>Valor: {question.points} ponto(s)</small>
                </div>
              ))}

              <button className="primary" onClick={() => review(attempt.id)}>Corrigir avaliação</button>
            </article>
          )
        })}
      </div>
    </div>
  )
}
