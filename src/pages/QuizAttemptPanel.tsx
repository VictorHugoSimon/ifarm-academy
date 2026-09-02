import { useMemo, useState } from 'react'
import { canStartAttempt } from '../application/quizScoring'
import { submitAttempt } from '../application/assessmentService'
import type { QuizAnswer, QuizDefinition } from '../domain/quiz'
import type { QuizAttempt } from '../domain/assessment'
import { createAttempt, loadAttempts, saveAttempt } from '../services/quizAttemptRepository'

const STUDENT_ID = 'DEMO-STUDENT-001'

export function QuizAttemptPanel({ quiz, onFinished }: {
  quiz: QuizDefinition
  onFinished?: (attempt: QuizAttempt) => void
}) {
  const [attempts, setAttempts] = useState(() => loadAttempts(quiz.id, STUDENT_ID))
  const [attempt, setAttempt] = useState<QuizAttempt | null>(
    () => attempts.find((item) => item.status === 'in_progress') ?? null,
  )
  const [answers, setAnswers] = useState<QuizAnswer[]>(() => attempt?.answers ?? [])

  const completedAttempts = attempts.filter((item) => item.status !== 'in_progress').length
  const canStart = canStartAttempt(quiz, completedAttempts)
  const questions = useMemo(() => {
    const items = [...quiz.questions]
    if (!quiz.randomizeQuestions) return items.sort((a, b) => a.position - b.position)
    return items.sort((a, b) => a.id.localeCompare(b.id))
  }, [quiz])

  function begin() {
    const created = createAttempt(quiz.id, STUDENT_ID)
    setAttempt(created)
    setAttempts(loadAttempts(quiz.id, STUDENT_ID))
    setAnswers([])
  }

  function updateAnswer(questionId: string, patch: Partial<QuizAnswer>) {
    const existing = answers.find((item) => item.questionId === questionId)
    const next = existing
      ? answers.map((item) => item.questionId === questionId ? { ...item, ...patch } : item)
      : [...answers, { questionId, ...patch }]

    setAnswers(next)
    if (attempt) {
      setAttempt(saveAttempt({ ...attempt, answers: next }))
    }
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

  function finish() {
    if (!attempt) return
    const submitted = submitAttempt(quiz, attempt, answers)
    saveAttempt(submitted)
    setAttempt(submitted)
    setAttempts(loadAttempts(quiz.id, STUDENT_ID))
    onFinished?.(submitted)
  }

  if (!attempt || attempt.status !== 'in_progress') {
    const lastAttempt = attempts.find((item) => item.status !== 'in_progress')
    return (
      <div className="attemptEntry">
        <small>Avaliação obrigatória</small>
        <h2>{quiz.title}</h2>
        <p>Nota mínima: {quiz.minimumScore}% · Tentativas: {completedAttempts}/{quiz.attemptsAllowed}</p>
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
        <button className="primary" disabled={!canStart} onClick={begin}>
          {canStart ? 'Iniciar avaliação' : 'Limite de tentativas atingido'}
        </button>
      </div>
    )
  }

  return (
    <div className="attemptPanel">
      <div className="attemptHeader">
        <div><small>Tentativa {attempt.attemptNumber}</small><h2>{quiz.title}</h2></div>
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
                        name={`question-${question.id}`}
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

      <div className="attemptFooter">
        <span>As respostas ficam salvas localmente durante esta validação.</span>
        <button className="primary" onClick={finish}>Enviar avaliação</button>
      </div>
    </div>
  )
}
