import { requireAdminContext } from './_auth'
import { numberValue,percent,resolveReportWindow } from './_reporting'
import { dbOr503,json,type Env } from './_shared'

const ADMIN_ROLES=['academy_admin','ifarm_admin']

export const onRequestGet=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireAdminContext(env,request,ADMIN_ROLES);if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  const window=resolveReportWindow(request);if(window instanceof Response)return window

  const cohort=await db.prepare(`SELECT COUNT(*) AS total,
    SUM(CASE WHEN stage='new' THEN 1 ELSE 0 END) AS new_count,
    SUM(CASE WHEN stage='qualified' THEN 1 ELSE 0 END) AS qualified,
    SUM(CASE WHEN stage='contacted' THEN 1 ELSE 0 END) AS contacted,
    SUM(CASE WHEN stage='opportunity' THEN 1 ELSE 0 END) AS opportunity_count,
    SUM(CASE WHEN stage='converted' THEN 1 ELSE 0 END) AS converted,
    SUM(CASE WHEN stage='discarded' THEN 1 ELSE 0 END) AS discarded,
    SUM(CASE WHEN consent_evidence_type='explicit_rule_opt_in' THEN 1 ELSE 0 END) AS explicit_rule_opt_ins,
    SUM(CASE WHEN consent_evidence_type IN ('explicit_event_interest','legacy_event_interest') THEN 1 ELSE 0 END) AS smart_farm_interests
    FROM academy_commercial_opportunities WHERE tenant_id=? AND created_at BETWEEN ? AND ?`)
    .bind(auth.tenantId,window.from,window.to).first()

  const conversions=await db.prepare(`SELECT COUNT(*) AS total FROM academy_commercial_opportunities
    WHERE tenant_id=? AND stage='converted' AND converted_at BETWEEN ? AND ?`).bind(auth.tenantId,window.from,window.to).first()

  const handoffs=await db.prepare(`SELECT
    SUM(CASE WHEN status IN ('pending','processing','failed') THEN 1 ELSE 0 END) AS open_count,
    SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
    SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
    SUM(CASE WHEN status='delivered' AND delivered_at BETWEEN ? AND ? THEN 1 ELSE 0 END) AS delivered_period
    FROM academy_commercial_handoff_outbox WHERE tenant_id=?`).bind(window.from,window.to,auth.tenantId).first()

  const evidence=await db.prepare(`SELECT COUNT(*) AS evidence_count
    FROM academy_commercial_conversion_evidence WHERE tenant_id=? AND confirmed_at BETWEEN ? AND ?`)
    .bind(auth.tenantId,window.from,window.to).first()

  const valueByCurrency=await db.prepare(`SELECT currency,COUNT(*) AS evidence_count,
    SUM(CASE WHEN attributed_value_cents IS NOT NULL THEN attributed_value_cents ELSE 0 END) AS attributed_value_cents
    FROM academy_commercial_conversion_evidence WHERE tenant_id=? AND confirmed_at BETWEEN ? AND ?
    GROUP BY currency ORDER BY currency`).bind(auth.tenantId,window.from,window.to).all()

  const bySource=await db.prepare(`SELECT source_type,COUNT(*) AS total,
    SUM(CASE WHEN stage='converted' THEN 1 ELSE 0 END) AS converted
    FROM academy_commercial_opportunities WHERE tenant_id=? AND created_at BETWEEN ? AND ?
    GROUP BY source_type ORDER BY total DESC,source_type`).bind(auth.tenantId,window.from,window.to).all()

  const byOffer=await db.prepare(`SELECT COALESCE(offer_system,'legacy_or_unclassified') AS offer_system,COUNT(*) AS total,
    SUM(CASE WHEN stage='converted' THEN 1 ELSE 0 END) AS converted
    FROM academy_commercial_opportunities WHERE tenant_id=? AND created_at BETWEEN ? AND ?
    GROUP BY COALESCE(offer_system,'legacy_or_unclassified') ORDER BY total DESC,offer_system`).bind(auth.tenantId,window.from,window.to).all()

  const byEvidenceSystem=await db.prepare(`SELECT evidence_system,currency,COUNT(*) AS evidence_count,
    SUM(CASE WHEN attributed_value_cents IS NOT NULL THEN attributed_value_cents ELSE 0 END) AS attributed_value_cents
    FROM academy_commercial_conversion_evidence WHERE tenant_id=? AND confirmed_at BETWEEN ? AND ?
    GROUP BY evidence_system,currency ORDER BY evidence_system,currency`).bind(auth.tenantId,window.from,window.to).all()

  const cohortTotal=numberValue(cohort?.total),cohortConverted=numberValue(cohort?.converted)
  return json({
    generatedAt:new Date().toISOString(),window,
    funnel:{
      opportunitiesCreated:cohortTotal,new:numberValue(cohort?.new_count),qualified:numberValue(cohort?.qualified),contacted:numberValue(cohort?.contacted),
      opportunity:numberValue(cohort?.opportunity_count),converted:cohortConverted,discarded:numberValue(cohort?.discarded),
      explicitRuleOptIns:numberValue(cohort?.explicit_rule_opt_ins),smartFarmInterests:numberValue(cohort?.smart_farm_interests),
      cohortConversionRate:percent(cohortConverted,cohortTotal),conversionsConfirmedInPeriod:numberValue(conversions?.total),
    },
    handoffs:{open:numberValue(handoffs?.open_count),pending:numberValue(handoffs?.pending),failed:numberValue(handoffs?.failed),deliveredInPeriod:numberValue(handoffs?.delivered_period)},
    attributedCommercialValue:{
      evidenceCount:numberValue(evidence?.evidence_count),
      totalsByCurrency:(valueByCurrency.results as any[]).map(row=>({currency:String(row.currency),evidenceCount:numberValue(row.evidence_count),confirmedAttributedValueCents:numberValue(row.attributed_value_cents)})),
    },
    bySource:(bySource.results as any[]).map(row=>({sourceType:String(row.source_type),opportunities:numberValue(row.total),converted:numberValue(row.converted),conversionRate:percent(numberValue(row.converted),numberValue(row.total))})),
    byOfferSystem:(byOffer.results as any[]).map(row=>({offerSystem:String(row.offer_system),opportunities:numberValue(row.total),converted:numberValue(row.converted),conversionRate:percent(numberValue(row.converted),numberValue(row.total))})),
    byEvidenceSystem:(byEvidenceSystem.results as any[]).map(row=>({evidenceSystem:String(row.evidence_system),currency:String(row.currency),evidenceCount:numberValue(row.evidence_count),confirmedAttributedValueCents:numberValue(row.attributed_value_cents)})),
    accountingDisclaimer:'Valor atribuído confirmado é evidência comercial referenciada e segregada por moeda; não substitui faturamento, recebimento ou contabilidade oficial.',
  })
}
