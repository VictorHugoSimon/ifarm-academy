import type { CourseBuilderState } from '../domain/builder'

export const courseBuilderDemo: CourseBuilderState = {
  courseId: 'C001',
  title: 'Agricultura Digital',
  modules: [
    {
      id: 'M001',
      title: 'Fundamentos da Agricultura Digital',
      description: 'Conceitos, evolução e aplicações no campo.',
      position: 0,
      lessons: [
        {
          id: 'L001',
          title: 'O que é agricultura digital',
          contentType: 'video',
          durationMinutes: 18,
          required: true,
          position: 0,
          content: { provider: 'academy-video', providerRef: 'demo-agricultura-digital-01' },
        },
        {
          id: 'L002',
          title: 'Ecossistema de dados no agro',
          contentType: 'text',
          durationMinutes: 12,
          required: true,
          position: 1,
          content: {
            body: 'A agricultura digital conecta dados de campo, máquinas, sensores, clima e gestão para apoiar decisões mais rápidas e rastreáveis.',
          },
        },
        {
          id: 'L003',
          title: 'Material de apoio',
          contentType: 'pdf',
          durationMinutes: 8,
          required: false,
          position: 2,
          content: {},
        },
      ],
    },
    {
      id: 'M002',
      title: 'Sensores, IoT e Telemetria',
      description: 'Dispositivos, conectividade e coleta de dados.',
      position: 1,
      lessons: [
        {
          id: 'L004',
          title: 'Sensores de campo',
          contentType: 'video',
          durationMinutes: 22,
          required: true,
          position: 0,
          content: { provider: 'academy-video', providerRef: 'demo-sensores-campo-01' },
        },
        {
          id: 'L005',
          title: 'LoRaWAN e conectividade rural',
          contentType: 'presentation',
          durationMinutes: 20,
          required: true,
          position: 1,
          content: { provider: 'academy-storage', providerRef: 'demo-lorawan-apresentacao-01', fileName: 'lorawan-conectividade-rural.pdf' },
        },
      ],
    },
    {
      id: 'M003',
      title: 'Aplicação prática',
      description: 'Uso dos dados em decisões agronômicas.',
      position: 2,
      lessons: [
        {
          id: 'L006',
          title: 'Estudo de caso Smart Farm',
          contentType: 'case_study',
          durationMinutes: 30,
          required: true,
          position: 0,
          content: { instructions: 'Analise como dados de sensores, clima e operação podem ser combinados para identificar oportunidades de melhoria em uma Smart Farm.' },
        },
        {
          id: 'L007',
          title: 'Atividade prática',
          contentType: 'practical_activity',
          durationMinutes: 45,
          required: true,
          position: 1,
          content: { instructions: 'Mapeie uma decisão agrícola que poderia ser melhorada por dados e descreva quais fontes seriam necessárias.' },
        },
      ],
    },
  ],
  quiz: { enabled: true, minimumScore: 70, attemptsAllowed: 3 },
}
