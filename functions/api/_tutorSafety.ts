import type { TutorEvidence } from './_tutor'

export type TutorPromptRiskFlag =
  | 'instruction_override'
  | 'prompt_exfiltration'
  | 'secret_exfiltration'
  | 'role_override'
  | 'source_instruction_execution'

export interface TutorPromptRiskAssessment {
  flags: TutorPromptRiskFlag[]
  blockProvider: boolean
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const RULES: Array<{ flag: TutorPromptRiskFlag; patterns: RegExp[] }> = [
  {
    flag: 'instruction_override',
    patterns: [
      /ignore (all |the )?(previous|prior|system|developer) (instructions?|rules?)/,
      /disregard (all |the )?(previous|prior|system|developer) (instructions?|rules?)/,
      /ignore (as |todas |todas as )?(instrucoes|regras) (anteriores|previas|do sistema)/,
      /desconsidere (as |todas |todas as )?(instrucoes|regras) (anteriores|previas|do sistema)/,
      /sobrescreva (as )?(regras|instrucoes)/,
      /override (the )?(rules|instructions)/,
    ],
  },
  {
    flag: 'prompt_exfiltration',
    patterns: [
      /(show|reveal|print|expose|dump) (the )?(system|developer) prompt/,
      /(mostre|revele|exiba|imprima) (o )?(prompt|texto) (de )?(sistema|developer|desenvolvedor)/,
      /what are your hidden instructions/,
      /quais sao suas instrucoes ocultas/,
    ],
  },
  {
    flag: 'secret_exfiltration',
    patterns: [
      /(show|reveal|print|expose|dump).{0,30}(secret|token|api key|password|credential)/,
      /(mostre|revele|exiba|imprima).{0,30}(segredo|token|chave de api|senha|credencial)/,
    ],
  },
  {
    flag: 'role_override',
    patterns: [
      /you are now (an?|the )?/,
      /act as (an?|the )?.{0,30}(system|developer|administrator|root)/,
      /agora voce e (um |uma )?/,
      /aja como (um |uma )?.{0,30}(sistema|desenvolvedor|administrador|root)/,
      /jailbreak/,
    ],
  },
  {
    flag: 'source_instruction_execution',
    patterns: [
      /(execute|follow|obey) (the )?(instructions?|commands?) (inside|in) (the )?(source|document|context)/,
      /(execute|siga|obedeca) (as )?(instrucoes|comandos) (da|na|dentro da) (fonte|documento|contexto)/,
    ],
  },
]

function scan(text: string): TutorPromptRiskFlag[] {
  const normalized = normalize(text)
  if (!normalized) return []
  const flags: TutorPromptRiskFlag[] = []
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) flags.push(rule.flag)
  }
  return flags
}

export function assessTutorPromptRisk(question: string, evidence: TutorEvidence[]): TutorPromptRiskAssessment {
  const found = new Set<TutorPromptRiskFlag>()
  for (const flag of scan(question)) found.add(flag)
  for (const item of evidence.slice(0, 5)) {
    for (const flag of scan(item.text)) found.add(flag)
  }
  const flags = [...found]
  return { flags, blockProvider: flags.length > 0 }
}
