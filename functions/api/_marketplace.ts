export type MarketplaceSubmissionStatus =
  | 'submitted' | 'under_review' | 'changes_requested' | 'approved'
  | 'rejected' | 'published' | 'withdrawn'

export type CommissionMode = 'percentage' | 'fixed_amount'
export type GatewayFeeResponsibility = 'ifarm' | 'instructor' | 'partner' | 'shared'

export const marketplaceTransitions: Record<MarketplaceSubmissionStatus, MarketplaceSubmissionStatus[]> = {
  submitted: ['under_review', 'withdrawn'],
  under_review: ['changes_requested', 'approved', 'rejected'],
  changes_requested: ['submitted', 'withdrawn'],
  approved: ['published', 'withdrawn'],
  rejected: ['submitted', 'withdrawn'],
  published: ['withdrawn'],
  withdrawn: [],
}

export function canTransitionMarketplace(from: string, to: string): boolean {
  return (marketplaceTransitions[from as MarketplaceSubmissionStatus] ?? []).includes(to as MarketplaceSubmissionStatus)
}

export interface CommissionRuleInput {
  calculationMode: CommissionMode
  ifarmShareValue: number
  instructorShareValue: number
  partnerShareValue: number
  currency?: string
  gatewayFeeResponsibility: GatewayFeeResponsibility
  validFrom: string
  validUntil?: string | null
  rationale: string
  confirmed: boolean
}

export function validateCommissionRule(input: CommissionRuleInput): string[] {
  const errors: string[] = []
  const values = [input.ifarmShareValue, input.instructorShareValue, input.partnerShareValue]

  if (!['percentage', 'fixed_amount'].includes(input.calculationMode)) errors.push('calculationMode inválido')
  if (values.some((value) => !Number.isInteger(value) || value < 0)) errors.push('shares devem ser inteiros não negativos')

  if (input.calculationMode === 'percentage' && values.every(Number.isInteger)) {
    if (values.some((value) => value > 10000)) errors.push('share percentual não pode superar 10000 basis points')
    if (values.reduce((sum, value) => sum + value, 0) !== 10000) errors.push('shares percentuais devem totalizar 10000 basis points')
  }

  if (input.calculationMode === 'fixed_amount' && values.every(Number.isInteger)) {
    if (values.reduce((sum, value) => sum + value, 0) <= 0) errors.push('regra fixa precisa distribuir valor maior que zero')
  }

  if (!['ifarm', 'instructor', 'partner', 'shared'].includes(input.gatewayFeeResponsibility)) {
    errors.push('gatewayFeeResponsibility inválido')
  }

  const validFrom = new Date(input.validFrom)
  if (Number.isNaN(validFrom.getTime())) errors.push('validFrom inválido')
  if (input.validUntil) {
    const validUntil = new Date(input.validUntil)
    if (Number.isNaN(validUntil.getTime())) errors.push('validUntil inválido')
    else if (!Number.isNaN(validFrom.getTime()) && validUntil.getTime() <= validFrom.getTime()) {
      errors.push('validUntil deve ser posterior a validFrom')
    }
  }

  if (!input.rationale?.trim()) errors.push('rationale é obrigatório')
  if (input.confirmed !== true) errors.push('confirmação humana explícita é obrigatória')
  return errors
}

export function commissionRuleIsEffective(rule: { status: string; valid_from: string; valid_until?: string | null }, now = new Date()): boolean {
  if (rule.status !== 'active') return false
  const from = new Date(rule.valid_from)
  if (Number.isNaN(from.getTime()) || from.getTime() > now.getTime()) return false
  if (rule.valid_until) {
    const until = new Date(rule.valid_until)
    if (Number.isNaN(until.getTime()) || until.getTime() <= now.getTime()) return false
  }
  return true
}
