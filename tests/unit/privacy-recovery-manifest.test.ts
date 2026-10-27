import { describe, expect, it } from 'vitest'
import { calendarMonths, signPrivacyRecoveryManifest, verifyPrivacyRecoveryManifest, type PrivacyRecoveryEntry } from '../../src/modules/marketing/privacy-recovery-manifest'
import { assertPrivacyRecoveryIsolation } from '../../src/modules/marketing/privacy-recovery'
import { createHmac } from 'node:crypto'

const secret = 'synthetic-recovery-secret'.padEnd(48,'x'), now = Date.UTC(2026,9,25), snapshotAt = new Date(now-86400000).toISOString()
const occurredAt = new Date(now-1000).toISOString()
const entry: PrivacyRecoveryEntry = { kind: 'delete', fingerprint: 'a'.repeat(64), occurredAt, expiresAt: calendarMonths(occurredAt,24), deliveryState: null, outcome: 'completed' }
const manifest = () => JSON.stringify(signPrivacyRecoveryManifest([entry],secret,now))
describe('Manifesto privado de recuperação', () => {
  it('autentica versão, finalidade, prazo e chaves sem endereço', () => {
    expect(verifyPrivacyRecoveryManifest(manifest(),secret,snapshotAt,now).entries).toEqual([entry])
    expect(verifyPrivacyRecoveryManifest(manifest(),secret,snapshotAt.replace('.000Z','.000000+00:00'),now).entries).toEqual([entry])
    expect(manifest()).not.toContain('@')
    expect(() => verifyPrivacyRecoveryManifest(manifest(),secret+'other',snapshotAt,now)).toThrow()
  })
  it('recusa adulteração, campo extra, assinatura ausente e versão desconhecida', () => {
    for (const change of [{version:99},{email:'synthetic@example.invalid'},{signature:'0'.repeat(64)},{entries:[{...entry,kind:'correct'}]}]) expect(() => verifyPrivacyRecoveryManifest(JSON.stringify({...JSON.parse(manifest()),...change}),secret,snapshotAt,now)).toThrow()
  })
  it('recusa manifesto anterior ao backup e backup fora dos três meses de retenção', () => {
    expect(() => verifyPrivacyRecoveryManifest(manifest(),secret,new Date(now+1).toISOString(),now)).toThrow()
    expect(() => verifyPrivacyRecoveryManifest(manifest(),secret,calendarMonths(new Date(now).toISOString(),-4),now)).toThrow()
    expect(() => verifyPrivacyRecoveryManifest(manifest(),secret,snapshotAt,now-300001)).toThrow()
  })
  it('recusa duplicatas, prazo estendido, fingerprint inválido e coleção acima do limite', () => {
    for (const entries of [[entry,entry],[{...entry,expiresAt:calendarMonths(occurredAt,25)}],[{...entry,fingerprint:'invalid'}],Array.from({length:10001},()=>entry)]) expect(() => signPrivacyRecoveryManifest(entries,secret,now)).toThrow()
  })
  it('preserva prazos de fim de mês e estados desconhecidos sem inventar causa', () => {
    expect(calendarMonths('2024-02-29T00:00:00.000Z',24)).toBe('2026-02-28T00:00:00.000Z')
    const suppression: PrivacyRecoveryEntry = {kind:'suppression',fingerprint:'b'.repeat(64),occurredAt:null,expiresAt:calendarMonths(occurredAt,12),deliveryState:'unknown',outcome:'completed'}
    expect(verifyPrivacyRecoveryManifest(JSON.stringify(signPrivacyRecoveryManifest([suppression],secret,now)),secret,snapshotAt,now).entries[0].deliveryState).toBe('unknown')
  })
  it('recusa transporte, coleta ou processamento habilitados e isolamento não declarado', () => {
    expect(() => assertPrivacyRecoveryIsolation(false,{})).toThrow()
    for (const flag of ['LEADS_ENABLED','EMAIL_TRANSPORT_ENABLED','BREVO_CAMPAIGN_SEND_ENABLED','COMMERCIAL_EVENTS_ENABLED','DATA_RETENTION_ENABLED','HOTMART_WEBHOOK_ENABLED']) expect(() => assertPrivacyRecoveryIsolation(true,{[flag]:'true'})).toThrow()
    expect(() => assertPrivacyRecoveryIsolation(true,{EMAIL_TRANSPORT_ENABLED:'false'})).not.toThrow()
  })
  it('mantém compatibilidade da assinatura v1 e normaliza decisão como concluída', () => {
    const payload = {version:1,generatedAt:new Date(now).toISOString(),entries:[{kind:entry.kind,fingerprint:entry.fingerprint,occurredAt:entry.occurredAt,expiresAt:entry.expiresAt,deliveryState:entry.deliveryState}]}
    const signature = createHmac('sha256',secret).update('bibliotheon:privacy-recovery:v1\n').update(JSON.stringify(payload)).digest('hex')
    expect(verifyPrivacyRecoveryManifest(JSON.stringify({...payload,signature}),secret,snapshotAt,now).entries[0].outcome).toBe('completed')
  })
  it('preserva pendência antiga sem prazo e recusa expiração ou supressão pendente', () => {
    const pending: PrivacyRecoveryEntry = {...entry,outcome:'pending',occurredAt:'2020-01-01T00:00:00.000Z',expiresAt:null}
    const signed = signPrivacyRecoveryManifest([pending],secret,now)
    expect(signed.version).toBe(2)
    expect(verifyPrivacyRecoveryManifest(JSON.stringify(signed),secret,snapshotAt,now).entries[0]).toEqual(pending)
    expect(() => signPrivacyRecoveryManifest([{...pending,expiresAt:entry.expiresAt}],secret,now)).toThrow()
    expect(() => signPrivacyRecoveryManifest([{...pending,kind:'suppression',deliveryState:'unknown',occurredAt:null}],secret,now)).toThrow()
  })
  it('assina expurgo automático em v3 sem mudar exports v2 e preserva prazo de 24 meses', () => {
    const retention: PrivacyRecoveryEntry = {...entry,kind:'retention'}
    const signed = signPrivacyRecoveryManifest([retention],secret,now)
    expect(signed.version).toBe(3)
    expect(verifyPrivacyRecoveryManifest(JSON.stringify(signed),secret,snapshotAt,now).entries).toEqual([retention])
    expect(signPrivacyRecoveryManifest([entry],secret,now).version).toBe(2)
    expect(() => signPrivacyRecoveryManifest([{...retention,outcome:'pending',expiresAt:null}],secret,now)).toThrow()
    expect(() => signPrivacyRecoveryManifest([{...retention,expiresAt:calendarMonths(occurredAt,25)}],secret,now)).toThrow()
  })
  it('recusa retention em wire v2 mesmo com assinatura válida dessa versão', () => {
    const value={version:2,generatedAt:new Date(now).toISOString(),entries:[{...entry,kind:'retention'}]}
    const signature=createHmac('sha256',secret).update('bibliotheon:privacy-recovery:v1\n').update(JSON.stringify(value)).digest('hex')
    expect(()=>verifyPrivacyRecoveryManifest(JSON.stringify({...value,signature}),secret,snapshotAt,now)).toThrow()
  })

  it('assina retirada temática v4 com assunto explícito e mantém v2/v3 legíveis', () => {
    const thematic: PrivacyRecoveryEntry = { ...entry, kind: 'theme-unsubscribe', theme: '11111111-1111-4111-8111-111111111111' }
    const signed = signPrivacyRecoveryManifest([thematic, {...entry, kind:'retention'}], secret, now)
    expect(signed.version).toBe(4)
    expect(verifyPrivacyRecoveryManifest(JSON.stringify(signed), secret, snapshotAt, now).entries).toContainEqual(thematic)
    expect(signPrivacyRecoveryManifest([entry],secret,now).version).toBe(2)
    expect(signPrivacyRecoveryManifest([{...entry,kind:'retention'}],secret,now).version).toBe(3)
  })
  it('distingue temas do mesmo titular e rejeita prazo, duplicata, pending e assunto inválidos', () => {
    const thematic: PrivacyRecoveryEntry = { ...entry, kind:'theme-unsubscribe', theme:'11111111-1111-4111-8111-111111111111' }
    expect(signPrivacyRecoveryManifest([thematic,{...thematic,theme:'22222222-2222-4222-8222-222222222222'}],secret,now).entries).toHaveLength(2)
    for (const rows of [[thematic,thematic],[{...thematic,theme:'invalid'}],[{...thematic,theme:undefined}],[{...thematic,outcome:'pending' as const,expiresAt:null}],[{...thematic,expiresAt:calendarMonths(occurredAt,25)}]]) expect(()=>signPrivacyRecoveryManifest(rows,secret,now)).toThrow()
  })
  it('recusa entrada temática em versão antiga mesmo com assinatura válida', () => {
    for (const version of [2,3]) {
      const value={version,generatedAt:new Date(now).toISOString(),entries:[{...entry,kind:'theme-unsubscribe',theme:'11111111-1111-4111-8111-111111111111'}]}
      const signature=createHmac('sha256',secret).update('bibliotheon:privacy-recovery:v1\n').update(JSON.stringify(value)).digest('hex')
      expect(()=>verifyPrivacyRecoveryManifest(JSON.stringify({...value,signature}),secret,snapshotAt,now)).toThrow()
    }
  })

})
