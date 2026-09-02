import { useEffect, useMemo, useState } from 'react'
import { applyManualReview } from '../application/assessmentService'
import { loadQuiz } from '../services/quizRepository'
import { loadAttempts, saveAttempt } from '../services/quizAttemptRepository'
import { loadReviewQueue, submitManualReview, type ReviewQueueItem } from '../services/assessmentReviewApi'
import '../styles/assessment-cert.css'

const STUDENT_ID = 'DEMO-STUDENT-001'

export function AssessmentReviewPage() {
  const quiz = useMemo(() => loadQuiz(), [])
  const [attempts, setAttempts] = useState(() => loadAttempts(quiz.id, STUDENT_ID))
  const [serverQueue, setServerQueue] = useState<ReviewQueueItem[] | null>(null)
  const [loadingServer, setLoadingServer] = useState(true)
  const [serverMessage, setServerMessage] = useState('')
  const pending = attempts.filter((item) => item.status === 'manual_review')

  async function refreshServerQueue() {
    setLoadingServer(true)
    try {
      const items = await loadReviewQueue()
      setServerQueue(items)
      setServerMessage('')
    } catch {
      setServerQueue(null)
    } finally {
      setLoadingServer(false)
    }
  }

  useEffect(() => {
    void refreshServerQueue()
  }, [])

  function reviewLocal(attemptId: string) {
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

  async function reviewServer(item: ReviewQueueItem) {
    const pendingIds = item.automaticResult?.pendingManualQuestionIds ?? item.questions
      .filter((question) => question.type === 'open_answer' || question.manualReview)
      .map((question) => question.id)

    const reviews = [] as Array<{ questionId: string; awardedPoints: number; note?: string }>
    for (const questionId of pendingIds) {
      const question = item.questions.find((candidate) => candidate.id === questionId)
      if (!question) continue
      const pointsInput = window.prompt(
        `${question.prompt ?? `Questão ${question.id}`}\nPontuação de 0 a ${question.points}`,
        String(question.points),
      )
      if (pointsInput == null) return
      const awardedPoints = Number(pointsInput)
      if (!Number.isFinite(awardedPoints)) {
        setServerMessage('Informe uma pontuação numérica válida.')
        return
      }
      const note = window.prompt(`Observação da questão ${question.id}`, '') ?? ''
      reviews.push({ questionId, awardedPoints, note })
    }

    const reviewerId = window.prompt('ID do revisor', 'DEMO-REVIEWER-001')?.trim()
    if (!reviewerId) return
    const reviewerName = window.prompt('Nome do revisor', 'Responsável técnico')?.trim() || reviewerId
    const reviewNote = window.prompt('Observação geral da revisão', '') ?? ''

    try {
      const result = await submitManualReview(item.id, { reviewerId, reviewerName, reviewNote, reviews })
      setServerMessage(`Revisão concluída: ${result.data.status === 'approved' ? 'aprovado' : 'reprovado'} com ${result.data.finalPercentage}%.`)
      await refreshServerQueue()
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : 'Não foi possível concluir a revisão.')
    }
  }

  const usingServer = serverQueue !== null

  return (
    <div className="reviewPage">
      <div className="pageHeader">
        <div>
          <h1>Revisão de avaliações</h1>
          <p>Correção manual auditável de respostas abertas e consolidação da nota final no backend.</p>
        </div>
      </div>

      <div className="reviewCard" style={{ marginBottom: 14 }}>
        <strong>{loadingServer ? 'Verificando backend...' : usingServer ? 'Fila conectada ao backend' : 'Modo local de desenvolvimento'}</strong>
        <p>{usingServer
          ? 'As notas desta fila são enviadas ao endpoint server-side e o navegador não calcula o resultado final autoritativo.'
          : 'O backend não está disponível neste ambiente; a tela mantém o fluxo local para desenvolvimento e validação visual.'}
        </p>
        {serverMessage && <p><strong>{serverMessage}</strong></p>}
      </div>

      <div className="reviewList">
        {usingServer && serverQueue.length === 0 && (
          <div className="reviewCard">
            <strong>Nenhuma avaliação aguardando revisão.</strong>
            <p>A fila server-side está vazia.</p>
          </div>
        )}

        {usingServer && serverQueue.map((item) => {
          const pendingIds = item.automaticResult?.pendingManualQuestionIds ?? []
          return (
            <article className="reviewCard" key={item.id}>
              <div className="reviewCardHead">
                <div>
                  <small>Aluno {item.studentId} · Tentativa {item.attemptNumber}</small>
                  <h3>Quiz {item.quizId}</h3>
                  <small>Política v{item.policyVersion ?? 'legada'} · Nota mínima {item.minimumScore}%</small>
                </div>
                <span>Aguardando revisão</span>
              </div>

              {pendingIds.map((questionId) => {
                const question = item.questions.find((candidate) => candidate.id === questionId)
                const answer = item.answers.find((candidate) => candidate.questionId === questionId)?.answerText ?? ''
                return (
                  <div className="reviewAnswer" key={questionId}>
                    <strong>{question?.prompt ?? `Questão ${questionId}`}</strong>
                    <p>{answer || 'Sem resposta.'}</p>
                    <small>Valor máximo: {question?.points ?? 0} ponto(s)</small>
                  </div>
                )
              })}

              <button className="primary" onClick={() => void reviewServer(item)}>Corrigir no backend</button>
            </article>
          )
        })}

        {!usingServer && pending.length === 0 && (
          <div className="reviewCard">
            <strong>Nenhuma avaliação aguardando revisão.</strong>
            <p>Quando uma tentativa local tiver resposta aberta, ela será direcionada para esta fila.</p>
          </div>
        )}

        {!usingServer && pending.map((attempt) => {
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
                <span>Aguardando revisão local</span>
              </div>

              {openAnswers.map(({ question, answer }) => (
                <div className="reviewAnswer" key={question.id}>
                  <strong>{question.prompt}</strong>
                  <p>{answer || 'Sem resposta.'}</p>
                  <small>Valor: {question.points} ponto(s)</small>
                </div>
              ))}

              <button className="primary" onClick={() => reviewLocal(attempt.id)}>Corrigir avaliação local</button>
            </article>
          )
        })}
      </div>
    </div>
  )
}
