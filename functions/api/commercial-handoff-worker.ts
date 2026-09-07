import { auditStatement } from './_audit'
import { opportunityCommercialContactIsAllowed } from './_commercialConsent'
import { isCommercialHandoffDestination } from './_commercialHandoff'
import { claimExpiresAt, commercialWorkerConfig, requireCommercialWorker, retryAt } from './_commercialWorker'
import { bodyJson, dbOr503, json, safeJson, type Env } from './_shared'

function auditContext(worker:{workerId:string;tenantId:string}){
  return {tenantId:worker.tenantId,userId:`worker:${worker.workerId}`,roles:['academy_commercial_worker']}
}

async function cancelForPrivacy(db:any,worker:{workerId:string;tenantId:string},handoff:any,claim:any,now:string){
  const attempt=await db.prepare(`SELECT * FROM academy_commercial_handoff_attempts
    WHERE tenant_id=? AND claim_id=? AND status='processing' LIMIT 1`).bind(worker.tenantId,claim.id).first()
  const statements=[
    db.prepare(`UPDATE academy_commercial_handoff_outbox SET status='cancelled',next_attempt_at=NULL,last_error_code='privacy_blocked',updated_at=?
      WHERE tenant_id=? AND id=?`).bind(now,worker.tenantId,handoff.id),
    db.prepare(`UPDATE academy_commercial_handoff_claims SET released_at=?,release_reason='cancelled' WHERE tenant_id=? AND id=? AND released_at IS NULL`)
      .bind(now,worker.tenantId,claim.id),
    auditStatement(db,auditContext(worker),{action:'commercial_worker.cancelled_by_privacy',resourceType:'commercial_handoff',resourceId:String(handoff.id),metadata:{claimId:claim.id}}),
  ]
  if(attempt)statements.splice(2,0,db.prepare(`UPDATE academy_commercial_handoff_attempts SET status='failed',completed_at=?,error_code='consent_revoked_before_delivery'
    WHERE tenant_id=? AND id=? AND status='processing'`).bind(now,worker.tenantId,attempt.id))
  await db.batch(statements)
}

export const onRequestPost=async({env,request}:{env:Env;request:Request})=>{
  const worker=requireCommercialWorker(env,request);if(worker instanceof Response)return worker
  const db=dbOr503(env);if(db instanceof Response)return db
  let body:Record<string,unknown>;try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}
  const action=String(body.action??'').trim()
  const config=commercialWorkerConfig(env)
  const nowDate=new Date(),now=nowDate.toISOString()

  if(action==='claim'){
    const destination=String(body.destinationSystem??'ifarm_core').trim()
    if(!isCommercialHandoffDestination(destination))return json({error:'destinationSystem inválido'},400)

    for(let scan=0;scan<10;scan+=1){
      const candidate=await db.prepare(`SELECT h.*,o.user_id
        FROM academy_commercial_handoff_outbox h
        JOIN academy_commercial_opportunities o ON o.tenant_id=h.tenant_id AND o.id=h.opportunity_id
        WHERE h.tenant_id=? AND h.destination_system=?
          AND ((h.status='pending' AND (h.next_attempt_at IS NULL OR datetime(h.next_attempt_at)<=datetime(?)))
            OR (h.status='failed' AND h.next_attempt_at IS NOT NULL AND datetime(h.next_attempt_at)<=datetime(?)))
          AND NOT EXISTS (SELECT 1 FROM academy_commercial_handoff_claims c WHERE c.tenant_id=h.tenant_id AND c.handoff_id=h.id AND c.released_at IS NULL)
        ORDER BY COALESCE(h.next_attempt_at,h.created_at),h.created_at LIMIT 1`)
        .bind(worker.tenantId,destination,now,now).first()
      if(!candidate)return json({data:null,claimed:false})

      const allowed=await opportunityCommercialContactIsAllowed(db,worker.tenantId,String(candidate.user_id),String(candidate.opportunity_id))
      if(!allowed){
        await db.batch([
          db.prepare(`UPDATE academy_commercial_handoff_outbox SET status='cancelled',next_attempt_at=NULL,last_error_code='privacy_blocked',updated_at=?
            WHERE tenant_id=? AND id=? AND status IN ('pending','failed')`).bind(now,worker.tenantId,candidate.id),
          auditStatement(db,auditContext(worker),{action:'commercial_worker.skipped_by_privacy',resourceType:'commercial_handoff',resourceId:String(candidate.id),metadata:{destinationSystem:destination}}),
        ])
        continue
      }

      const claimId=crypto.randomUUID(),claimToken=crypto.randomUUID(),attemptId=crypto.randomUUID()
      const attemptNumber=Number(candidate.attempts)+1
      const expiresAt=claimExpiresAt(nowDate,config.claimTtlSeconds)
      try{await db.batch([
        db.prepare(`INSERT INTO academy_commercial_handoff_claims
          (id,tenant_id,handoff_id,claim_token,worker_id,claimed_at,expires_at)
          VALUES (?,?,?,?,?,?,?)`).bind(claimId,worker.tenantId,candidate.id,claimToken,worker.workerId,now,expiresAt),
        db.prepare(`UPDATE academy_commercial_handoff_outbox SET status='processing',attempts=?,next_attempt_at=NULL,last_error_code=NULL,updated_at=?
          WHERE tenant_id=? AND id=? AND status IN ('pending','failed')`).bind(attemptNumber,now,worker.tenantId,candidate.id),
        db.prepare(`INSERT INTO academy_commercial_handoff_attempts
          (id,tenant_id,handoff_id,claim_id,worker_id,attempt_number,status,started_at)
          VALUES (?,?,?,?,?,?,'processing',?)`).bind(attemptId,worker.tenantId,candidate.id,claimId,worker.workerId,attemptNumber,now),
        auditStatement(db,auditContext(worker),{action:'commercial_worker.claimed',resourceType:'commercial_handoff',resourceId:String(candidate.id),metadata:{claimId,attemptId,attemptNumber,destinationSystem:destination,expiresAt}}),
      ])}catch{return json({error:'Claim concorrente ou handoff não está mais disponível; tente novamente'},409)}

      return json({data:{handoffId:String(candidate.id),claimToken,claimExpiresAt:expiresAt,attemptNumber,destinationSystem:destination,eventType:String(candidate.event_type),payloadVersion:Number(candidate.payload_version),payload:safeJson(candidate.payload_json,{})},claimed:true})
    }
    return json({data:null,claimed:false,reason:'privacy_filtered'})
  }

  if(action==='delivered'||action==='failed'){
    const handoffId=String(body.handoffId??'').trim(),claimToken=String(body.claimToken??'').trim()
    if(!handoffId||!claimToken)return json({error:'handoffId e claimToken são obrigatórios'},400)
    const claim=await db.prepare(`SELECT * FROM academy_commercial_handoff_claims
      WHERE tenant_id=? AND handoff_id=? AND claim_token=? AND worker_id=? AND released_at IS NULL LIMIT 1`)
      .bind(worker.tenantId,handoffId,claimToken,worker.workerId).first()
    if(!claim)return json({error:'Claim ativo não encontrado para este worker/tenant'},409)
    const handoff=await db.prepare(`SELECT h.*,o.user_id FROM academy_commercial_handoff_outbox h
      JOIN academy_commercial_opportunities o ON o.tenant_id=h.tenant_id AND o.id=h.opportunity_id
      WHERE h.tenant_id=? AND h.id=? LIMIT 1`).bind(worker.tenantId,handoffId).first()
    if(!handoff||String(handoff.status)!=='processing')return json({error:'Handoff não está em processamento'},409)
    const attempt=await db.prepare(`SELECT * FROM academy_commercial_handoff_attempts
      WHERE tenant_id=? AND claim_id=? AND status='processing' LIMIT 1`).bind(worker.tenantId,claim.id).first()
    if(!attempt)return json({error:'Tentativa ativa não encontrada'},409)

    if(action==='delivered'){
      const deliveryReference=String(body.deliveryReference??'').trim()
      if(!deliveryReference)return json({error:'deliveryReference é obrigatória'},400)
      const allowed=await opportunityCommercialContactIsAllowed(db,worker.tenantId,String(handoff.user_id),String(handoff.opportunity_id))
      if(!allowed){await cancelForPrivacy(db,worker,handoff,claim,now);return json({error:'Entrega cancelada porque o consentimento foi revogado antes da confirmação',cancelled:true},409)}
      try{await db.batch([
        db.prepare(`UPDATE academy_commercial_handoff_outbox SET status='delivered',delivery_reference=?,delivered_at=?,last_error_code=NULL,next_attempt_at=NULL,updated_at=?
          WHERE tenant_id=? AND id=? AND status='processing'`).bind(deliveryReference,now,now,worker.tenantId,handoffId),
        db.prepare(`UPDATE academy_commercial_handoff_claims SET released_at=?,release_reason='delivered' WHERE tenant_id=? AND id=? AND released_at IS NULL`).bind(now,worker.tenantId,claim.id),
        db.prepare(`UPDATE academy_commercial_handoff_attempts SET status='delivered',completed_at=?,delivery_reference=?
          WHERE tenant_id=? AND id=? AND status='processing'`).bind(now,deliveryReference,worker.tenantId,attempt.id),
        auditStatement(db,auditContext(worker),{action:'commercial_worker.delivered',resourceType:'commercial_handoff',resourceId:handoffId,metadata:{claimId:claim.id,attemptNumber:attempt.attempt_number,deliveryReference}}),
      ])}catch{return json({error:'Confirmação de entrega rejeitada'},409)}
      return json({data:{handoffId,status:'delivered',deliveryReference,deliveredAt:now}})
    }

    const errorCode=String(body.errorCode??'').trim()
    if(!errorCode)return json({error:'errorCode é obrigatório'},400)
    const retryable=body.retryable!==false
    const attempts=Number(handoff.attempts)
    const willRetry=retryable&&attempts<config.maxAttempts
    const nextAttemptAt=willRetry?retryAt(nowDate,attempts):null
    const deadLetterId=willRetry?null:crypto.randomUUID()
    const statements=[
      db.prepare(`UPDATE academy_commercial_handoff_outbox SET status='failed',last_error_code=?,next_attempt_at=?,updated_at=?
        WHERE tenant_id=? AND id=? AND status='processing'`).bind(errorCode,nextAttemptAt,now,worker.tenantId,handoffId),
      db.prepare(`UPDATE academy_commercial_handoff_claims SET released_at=?,release_reason='failed' WHERE tenant_id=? AND id=? AND released_at IS NULL`).bind(now,worker.tenantId,claim.id),
      db.prepare(`UPDATE academy_commercial_handoff_attempts SET status='failed',completed_at=?,error_code=?
        WHERE tenant_id=? AND id=? AND status='processing'`).bind(now,errorCode,worker.tenantId,attempt.id),
      auditStatement(db,auditContext(worker),{action:willRetry?'commercial_worker.failed_retryable':'commercial_worker.dead_lettered',resourceType:'commercial_handoff',resourceId:handoffId,metadata:{claimId:claim.id,attempts,errorCode,nextAttemptAt}}),
    ]
    if(deadLetterId)statements.splice(3,0,db.prepare(`INSERT OR IGNORE INTO academy_commercial_handoff_dead_letters
      (id,tenant_id,handoff_id,attempts,reason_code,created_at) VALUES (?,?,?,?,?,?)`).bind(deadLetterId,worker.tenantId,handoffId,attempts,errorCode,now))
    try{await db.batch(statements)}catch{return json({error:'Falha do handoff não pôde ser registrada'},409)}
    return json({data:{handoffId,status:'failed',attempts,retryScheduled:willRetry,nextAttemptAt,deadLettered:!willRetry}})
  }

  if(action==='recover_expired'){
    const expired=await db.prepare(`SELECT c.*,h.attempts,h.status AS handoff_status
      FROM academy_commercial_handoff_claims c
      JOIN academy_commercial_handoff_outbox h ON h.tenant_id=c.tenant_id AND h.id=c.handoff_id
      WHERE c.tenant_id=? AND c.released_at IS NULL AND datetime(c.expires_at)<=datetime(?)
      ORDER BY c.seq LIMIT 20`).bind(worker.tenantId,now).all()
    let recovered=0,deadLettered=0
    for(const claim of expired.results as any[]){
      if(String(claim.handoff_status)!=='processing'){
        await db.prepare(`UPDATE academy_commercial_handoff_claims SET released_at=?,release_reason='cancelled' WHERE tenant_id=? AND id=? AND released_at IS NULL`)
          .bind(now,worker.tenantId,claim.id).run();continue
      }
      const attempt=await db.prepare(`SELECT * FROM academy_commercial_handoff_attempts WHERE tenant_id=? AND claim_id=? AND status='processing' LIMIT 1`)
        .bind(worker.tenantId,claim.id).first()
      const attempts=Number(claim.attempts),willRetry=attempts<config.maxAttempts,nextAttemptAt=willRetry?retryAt(nowDate,attempts):null
      const statements=[
        db.prepare(`UPDATE academy_commercial_handoff_outbox SET status='failed',last_error_code='claim_timeout',next_attempt_at=?,updated_at=? WHERE tenant_id=? AND id=? AND status='processing'`)
          .bind(nextAttemptAt,now,worker.tenantId,claim.handoff_id),
        db.prepare(`UPDATE academy_commercial_handoff_claims SET released_at=?,release_reason='timeout' WHERE tenant_id=? AND id=? AND released_at IS NULL`).bind(now,worker.tenantId,claim.id),
        auditStatement(db,auditContext(worker),{action:willRetry?'commercial_worker.claim_timeout':'commercial_worker.claim_timeout_dead_letter',resourceType:'commercial_handoff',resourceId:String(claim.handoff_id),metadata:{claimId:claim.id,attempts,nextAttemptAt}}),
      ]
      if(attempt)statements.splice(2,0,db.prepare(`UPDATE academy_commercial_handoff_attempts SET status='timed_out',completed_at=?,error_code='claim_timeout' WHERE tenant_id=? AND id=? AND status='processing'`).bind(now,worker.tenantId,attempt.id))
      if(!willRetry){statements.splice(statements.length-1,0,db.prepare(`INSERT OR IGNORE INTO academy_commercial_handoff_dead_letters
        (id,tenant_id,handoff_id,attempts,reason_code,created_at) VALUES (?,?,?,?, 'claim_timeout',?)`).bind(crypto.randomUUID(),worker.tenantId,claim.handoff_id,attempts,now));deadLettered+=1}
      await db.batch(statements);recovered+=1
    }
    return json({data:{recovered,deadLettered}})
  }

  return json({error:'action inválida'},400)
}
