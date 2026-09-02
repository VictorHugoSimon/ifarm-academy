import type { QuizDefinition } from '../domain/quiz'

const KEY = 'ifarm-academy:quiz-builder:v07'

export const defaultQuiz: QuizDefinition = {
  id: 'QUIZ-NR31-001',
  courseId: 'C003',
  title: 'Avaliação final — NR-31',
  description: 'Avaliação demonstrativa para validação do fluxo acadêmico.',
  minimumScore: 70,
  attemptsAllowed: 3,
  randomizeQuestions: true,
  showResultImmediately: true,
  status: 'draft',
  questions: [
    {
      id: 'Q1',
      type: 'multiple_choice',
      prompt: 'Qual é a principal finalidade de uma capacitação de segurança rural?',
      explanation: 'A capacitação deve reduzir riscos e apoiar práticas seguras no trabalho rural.',
      points: 2,
      position: 1,
      required: true,
      options: [
        { id: 'Q1-A', label: 'Aumentar somente a velocidade da operação', isCorrect: false, position: 1 },
        { id: 'Q1-B', label: 'Orientar prevenção de riscos e práticas seguras', isCorrect: true, position: 2 },
        { id: 'Q1-C', label: 'Substituir integralmente procedimentos internos', isCorrect: false, position: 3 },
      ],
    },
    {
      id: 'Q2',
      type: 'true_false',
      prompt: 'Treinamentos regulatórios podem exigir evidências adicionais além de conteúdo teórico.',
      points: 1,
      position: 2,
      required: true,
      options: [
        { id: 'Q2-T', label: 'Verdadeiro', isCorrect: true, position: 1 },
        { id: 'Q2-F', label: 'Falso', isCorrect: false, position: 2 },
      ],
    },
    {
      id: 'Q3',
      type: 'open_answer',
      prompt: 'Descreva uma medida prática para reduzir riscos durante uma atividade rural.',
      points: 2,
      position: 3,
      required: true,
      options: [],
    },
  ],
}

export function loadQuiz(): QuizDefinition {
  const raw = localStorage.getItem(KEY)
  if (!raw) return structuredClone(defaultQuiz)
  try {
    return JSON.parse(raw) as QuizDefinition
  } catch {
    return structuredClone(defaultQuiz)
  }
}

export function saveQuiz(quiz: QuizDefinition): QuizDefinition {
  localStorage.setItem(KEY, JSON.stringify(quiz))
  return quiz
}

export function resetQuiz(): QuizDefinition {
  localStorage.removeItem(KEY)
  return structuredClone(defaultQuiz)
}
