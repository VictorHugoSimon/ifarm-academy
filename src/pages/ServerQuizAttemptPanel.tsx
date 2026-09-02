import { useEffect, useMemo, useState } from 'react'
import type { QuizAnswer } from '../domain/quiz'
import {
  loadServerAttempts,
  loadStudentAssessment,
  saveServerAttemptAnswers,
  startServerAttempt,
  submitServerAttempt,
  type ServerAttempt,
  type ServerAttemptSubmission,
  type StudentAssessmentDefinition,
} from '../services/studentAssessmentApi'

export function ServerQuizAttemptPanel({ quizId, onFinished }: {
  quizId: string
  onFinished?: (result: ServerAttemptSubmission) => void | Promise<void>
}) {
  const [assessment, setAssessment] = useState<StudentAssessmentDefinition | null>(null)
  const [attempts, setAttempts] = useState<ServerAttempt[]>([])
  const [attempt, setAttempt] = useState<ServerAttempt | null>(null)
  const [answers, setAnswers] = useState<QuizAnswer[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  async function refresh() {
    setLoading(true)
    try {
      const [definition, serverAttempts] = await Promise.all([
        loadStudentAssessment(quizId),
        loadServerAttempts(quizId),
      ])
      setAssessment(definition)
      setAttempts(serverAttempts)
      const active = serverAttempts.find((item) => item.status === 'in_progress') ?? null
      setAttempt(active)
      setAnswers(active?.answers ?? [])
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar a avaliação.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [quizId])

  const questions = useMemo(() => {
    if (!assessment) return []
    const items = [...assessment.questions]
    return assessment.randomizeQuestions
      ? items.sort((a, b) => a.id.localeCompare(b.id))
      : items
  }, [assessment])

  const completedAttempts = attempts.filter((item) => item.status !== 'in_progress').length
  const canStart = assessment?.attemptsAllowed == null || completedAttempts < assessment.attemptsAllowed
  const lastAttempt = [...attempts].reverse().find((item) => item.status !== 'in_progress')

  function updateAnswer(questionId: string, patch: Partial<QuizAnswer>) {
    const existing = answers.find((item) => item.questionId === questionId)
    setAnswers(existing
      ? answers.map((item) => item.questionId === questionId ? { ...item, ...patch } : item)
      : [...answers, { questionId, ...patch }])
  }

  function toggleOption(questionId: string, optionId: string, single: boolean) {
    const answer = answers.find((item) => item.questionId === questionId)
    const current = answer?.optionIds ?? []
    const optionIds = single
      ? [optionId]
      : current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId]
    updateAnswer(questionId, { optionIds })
  }

  async function begin() {
    setMessage('Iniciando tentativa...')
    try {
      const created = await startServerAttempt(quizId)
      setAttempt(created)
      setAnswers([])
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível iniciar a avaliação.')
    }
  }

  async function saveDraft() {
    if (!attempt) return
    setMessage('Salvando respostas...')
    try {
      await saveServerAttemptAnswers(attempt.id, answers)
      setMessage('Respostas salvas no backend.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar as respostas.')
    }
  }

  async function finish() {
    if (!attempt) return
    if (!window.confirm('Enviar esta avaliação para correção?')) return
    setMessage('Enviando avaliação...')
    try {
      await saveServerAttemptAnswers(attempt.id, answers)
      const result = await submitServerAttempt(attempt.id, answers)
      setMessage(
        result.status === 'manual_review'
          ? 'Avaliação enviada. Há resposta aguardando revisão manual.'
          : result.status === 'approved'
            ? `Avaliação aprovada${result.finalPercentage == null ? '' : ` com ${result.finalPercentage}%`}.`
            : `Avaliação não aprovada${result.finalPercentage == null ? '' : `: ${result.finalPercentage}%`}.`,
      )
      await refresh()
      await onFinished?.(result)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar a avaliação.')
    }
  }

  if (loading) return <div className="attemptEntry"><strong>Carregando avaliação...</strong></div>
  if (!assessment) return <div className="attemptEntry"><strong>Avaliação indisponível.</strong><p>{message}</p></div>

  if (!attempt || attempt.status !== 'in_progress') {
    return (
      <div className="attemptEntry">
        <small>Avaliação server-side · política v{assessment.version}</small>
        <h2>Avaliação final</h2>
        <p>
          Nota mínima: {assessment.minimumScore}% · Tentativas: {completedAttempts}/
          {assessment.attemptsAllowed ?? 'sem limite'}
        </p>
        {lastAttempt && (
          <div className={`attemptResult ${lastAttempt.status}`}>
            <strong>
              {lastAttempt.status === 'manual_review'
                ? 'Aguardando revisão manual'
                : lastAttempt.status === 'approved'
                  ? 'Avaliação aprovada'
                  : 'Avaliação não aprovada'}
            </strong>
            {lastAttempt.finalPercentage != null && <span>Nota: {lastAttempt.finalPercentage}%</span>}
          </div>
        )}
        {message && <p>{message}</p>}
        <button className="primary" disabled={!canStart} onClick={() => void begin()}>
          {canStart ? 'Iniciar avaliação' : 'Limite de tentativas atingido'}
        </button>
      </div>
    )
  }

  return (
    <div className="attemptPanel">
      <div className="attemptHeader">
        <div><small>Tentativa {attempt.attemptNumber}</small><h2>Avaliação final</h2></div>
        <span>{questions.length} questões</span>
      </div>

      {questions.map((question, index) => {
        const answer = answers.find((item) => item.questionId === question.id)
        return (
          <article className="attemptQuestion" key={question.id}>
            <div className="attemptQuestionTitle"><span>{index + 1}</span><strong>{question.prompt}</strong></div>
            {question.type === 'open_answer' ? (
              <textarea
                value={answer?.answerText ?? ''}
                placeholder="Digite sua resposta"
                onChange={(event) => updateAnswer(question.id, { answerText: event.target.value })}
              />
            ) : (
              <div className="attemptOptions">
                {question.options.map((option) => {
                  const checked = answer?.optionIds?.includes(option.id) ?? false
                  return (
                    <label key={option.id}>
                      <input
                        type={question.type === 'true_false' ? 'radio' : 'checkbox'}
                        name={`server-question-${question.id}`}
                        checked={checked}
                        onChange={() => toggleOption(question.id, option.id, question.type === 'true_false')}
                      />
                      <span>{option.label}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </article>
        )
      })}

      {message && <p>{message}</p>}
      <div className="attemptFooter">
        <button onClick={() => void saveDraft()}>Salvar rascunho</button>
        <button className="primary" onClick={() => void finish()}>Enviar avaliação</button>
      </div>
    </div>
  )
}
