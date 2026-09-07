import { json, type Env } from './_shared'

export interface CommercialWorkerContext { workerId:string; tenantId:string }
export interface CommercialWorkerConfig { maxAttempts:number; claimTtlSeconds:number }

function secureEqual(left:string,right:string){
  if(left.length!==right.length)return false
  let diff=0
  for(let i=0;i<left.length;i+=1)diff|=left.charCodeAt(i)^right.charCodeAt(i)
  return diff===0
}

function boundedInt(value:string|undefined,fallback:number,min:number,max:number){
  const parsed=Number(value)
  return Number.isInteger(parsed)&&parsed>=min&&parsed<=max?parsed:fallback
}

export function commercialWorkerConfig(env:Env):CommercialWorkerConfig{
  return {
    maxAttempts:boundedInt(env.ACADEMY_COMMERCIAL_WORKER_MAX_ATTEMPTS,5,1,20),
    claimTtlSeconds:boundedInt(env.ACADEMY_COMMERCIAL_WORKER_CLAIM_TTL_SECONDS,300,30,3600),
  }
}

export function requireCommercialWorker(env:Env,request:Request):CommercialWorkerContext|Response{
  const configured=env.ACADEMY_COMMERCIAL_WORKER_SECRET
  if(!configured)return json({error:'Commercial delivery worker boundary not configured'},503)
  const provided=request.headers.get('x-ifarm-commercial-worker-secret')??''
  if(!provided||!secureEqual(provided,configured))return json({error:'Commercial delivery worker authentication failed'},401)
  const workerId=request.headers.get('x-ifarm-worker-id')?.trim()??''
  const tenantId=request.headers.get('x-ifarm-tenant-id')?.trim()??''
  if(!workerId)return json({error:'Commercial delivery worker id is required'},401)
  if(!tenantId)return json({error:'Commercial delivery worker tenant is required'},401)
  return {workerId,tenantId}
}

export function retryDelaySeconds(attemptNumber:number){
  const attempt=Math.max(1,Math.floor(attemptNumber||1))
  return Math.min(60*(2**Math.min(attempt-1,8)),21600)
}

export function retryAt(from:Date,attemptNumber:number){
  return new Date(from.getTime()+retryDelaySeconds(attemptNumber)*1000).toISOString()
}

export function claimExpiresAt(from:Date,ttlSeconds:number){
  return new Date(from.getTime()+ttlSeconds*1000).toISOString()
}
