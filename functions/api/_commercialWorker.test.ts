import { describe,expect,it } from 'vitest'
import { claimExpiresAt, commercialWorkerConfig, requireCommercialWorker, retryAt, retryDelaySeconds } from './_commercialWorker'

describe('commercial worker boundary',()=>{
  it('uses bounded reversible defaults',()=>{
    expect(commercialWorkerConfig({})).toEqual({maxAttempts:5,claimTtlSeconds:300})
    expect(commercialWorkerConfig({ACADEMY_COMMERCIAL_WORKER_MAX_ATTEMPTS:'10',ACADEMY_COMMERCIAL_WORKER_CLAIM_TTL_SECONDS:'600'})).toEqual({maxAttempts:10,claimTtlSeconds:600})
    expect(commercialWorkerConfig({ACADEMY_COMMERCIAL_WORKER_MAX_ATTEMPTS:'999',ACADEMY_COMMERCIAL_WORKER_CLAIM_TTL_SECONDS:'1'})).toEqual({maxAttempts:5,claimTtlSeconds:300})
  })

  it('applies exponential retry with cap',()=>{
    expect(retryDelaySeconds(1)).toBe(60)
    expect(retryDelaySeconds(2)).toBe(120)
    expect(retryDelaySeconds(5)).toBe(960)
    expect(retryDelaySeconds(99)).toBe(15360)
  })

  it('calculates retry and claim expiration deterministically',()=>{
    const base=new Date('2026-09-07T21:00:00.000Z')
    expect(retryAt(base,1)).toBe('2026-09-07T21:01:00.000Z')
    expect(claimExpiresAt(base,300)).toBe('2026-09-07T21:05:00.000Z')
  })

  it('fails closed without configured secret',()=>{
    const result=requireCommercialWorker({},new Request('https://academy.test/api'))
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(503)
  })

  it('accepts trusted worker identity and tenant',()=>{
    const request=new Request('https://academy.test/api',{headers:{
      'x-ifarm-commercial-worker-secret':'secret-value','x-ifarm-worker-id':'worker-1','x-ifarm-tenant-id':'tenant-1',
    }})
    expect(requireCommercialWorker({ACADEMY_COMMERCIAL_WORKER_SECRET:'secret-value'},request)).toEqual({workerId:'worker-1',tenantId:'tenant-1'})
  })
})
