import { useMemo, useState } from 'react'
import type { QuizDefinition, QuizQuestionType } from '../domain/quiz'
import { loadQuiz, resetQuiz, saveQuiz } from '../services/quizRepository'
import '../styles/quiz-player.css'

const labels: Record<QuizQuestionType, string> = {
  multiple_choice: 'Múltipla escolha',
  true_false: 'Verdadeiro ou falso',
  open_answer: 'Resposta aberta',
}

export function QuizBuilderPage() {
  const [quiz, setQuiz] = useState<QuizDefinition>(() => loadQuiz())
  const totalPoints = useMemo(
    () => quiz.questions.reduce((sum, question) => sum + question.points, 0),
    [quiz.questions],
  )

  function persist(next: QuizDefinition) {
    setQuiz(saveQuiz(next))
  }

  function addQuestion(type: QuizQuestionType) {
    const position = quiz.questions.length + 1
    const id = crypto.randomUUID()
    const base = {
      id,
      type,
      prompt: 'Nova pergunta',
      points: 1,
      position,
      required: true,
      options: [] as Array<{ id: string; label: string; isCorrect: boolean; position: number }>,
    }

    if (type === 'multiple_choice') {
      base.options = [
        { id: crypto.randomUUID(), label: 'Alternativa A', isCorrect: true, position: 1 },
        { id: crypto.randomUUID(), label: 'Alternativa B', isCorrect: false, position: 2 },
      ]
    }
    if (type === 'true_false') {
      base.options = [
        { id: crypto.randomUUID(), label: 'Verdadeiro', isCorrect: true, position: 1 },
        { id: crypto.randomUUID(), label: 'Falso', isCorrect: false, position: 2 },
      ]
    }

    persist({ ...quiz, questions: [...quiz.questions, base] })
  }

  function updateQuestion(id: string, patch: Record<string, unknown>) {
    persist({
      ...quiz,
      questions: quiz.questions.map((question) =>
        question.id === id ? { ...question, ...patch } : question,
      ),
    })
  }

  function removeQuestion(id: string) {
    persist({
      ...quiz,
      questions: quiz.questions
        .filter((question) => question.id !== id)
        .map((question, index) => ({ ...question, position: index + 1 })),
    })
  }

  return (
    <div className="quizBuilderPage">
      <div className="pageHeader">
        <div>
          <h1>Quiz Builder</h1>
          <p>Configure avaliações, tentativas, nota mínima e correção manual.</p>
        </div>
        <div className="quizActions">
          <button onClick={() => setQuiz(resetQuiz())}>Restaurar exemplo</button>
          <button
            className="primary"
            onClick={() => persist({ ...quiz, status: quiz.status === 'draft' ? 'published' : 'draft' })}
          >
            {quiz.status === 'draft' ? 'Publicar avaliação' : 'Voltar para rascunho'}
          </button>
        </div>
      </div>

      <section className="quizSettingsPanel">
        <label>
          Título
          <input value={quiz.title} onChange={(e) => persist({ ...quiz, title: e.target.value })} />
        </label>
        <label>
          Nota mínima (%)
          <input type="number" min="0" max="100" value={quiz.minimumScore} onChange={(e) => persist({ ...quiz, minimumScore: Number(e.target.value) })} />
        </label>
        <label>
          Tentativas permitidas
          <input type="number" min="1" value={quiz.attemptsAllowed} onChange={(e) => persist({ ...quiz, attemptsAllowed: Number(e.target.value) })} />
        </label>
        <label className="quizCheck"><input type="checkbox" checked={quiz.randomizeQuestions} onChange={(e) => persist({ ...quiz, randomizeQuestions: e.target.checked })} /> Embaralhar perguntas</label>
        <label className="quizCheck"><input type="checkbox" checked={quiz.showResultImmediately} onChange={(e) => persist({ ...quiz, showResultImmediately: e.target.checked })} /> Mostrar resultado imediatamente</label>
        <div className="quizSummary"><strong>{quiz.questions.length}</strong><span>perguntas</span><strong>{totalPoints}</strong><span>pontos</span><strong>{quiz.minimumScore}%</strong><span>nota mínima</span></div>
      </section>

      <div className="questionToolbar">
        <strong>Questões</strong>
        <div>
          <button onClick={() => addQuestion('multiple_choice')}>Múltipla escolha</button>
          <button onClick={() => addQuestion('true_false')}>Verdadeiro/Falso</button>
          <button onClick={() => addQuestion('open_answer')}>Resposta aberta</button>
        </div>
      </div>

      <div className="questionList">
        {quiz.questions.map((question) => (
          <article className="questionCard" key={question.id}>
            <div className="questionCardHead">
              <div><span>Questão {question.position}</span><strong>{labels[question.type]}</strong></div>
              <button onClick={() => removeQuestion(question.id)}>Excluir</button>
            </div>
            <textarea value={question.prompt} onChange={(e) => updateQuestion(question.id, { prompt: e.target.value })} />
            <div className="questionMeta">
              <label>Pontos <input type="number" min="1" value={question.points} onChange={(e) => updateQuestion(question.id, { points: Number(e.target.value) })} /></label>
              <label><input type="checkbox" checked={question.required} onChange={(e) => updateQuestion(question.id, { required: e.target.checked })} /> Obrigatória</label>
            </div>
            {question.options.length > 0 && (
              <div className="optionList">
                {question.options.map((option) => (
                  <div className="optionRow" key={option.id}>
                    <input
                      type={question.type === 'true_false' ? 'radio' : 'checkbox'}
                      name={`correct-${question.id}`}
                      checked={option.isCorrect}
                      onChange={() => {
                        const options = question.options.map((item) => ({
                          ...item,
                          isCorrect: question.type === 'true_false' ? item.id === option.id : item.id === option.id ? !item.isCorrect : item.isCorrect,
                        }))
                        updateQuestion(question.id, { options })
                      }}
                    />
                    <input
                      value={option.label}
                      onChange={(e) => updateQuestion(question.id, {
                        options: question.options.map((item) => item.id === option.id ? { ...item, label: e.target.value } : item),
                      })}
                    />
                  </div>
                ))}
              </div>
            )}
            {question.type === 'open_answer' && <div className="manualReviewNote">Resposta aberta será encaminhada para correção manual.</div>}
          </article>
        ))}
      </div>
    </div>
  )
}
