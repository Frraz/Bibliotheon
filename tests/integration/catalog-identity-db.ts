import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {getPayload} from 'payload'
import {sql,type PostgresAdapter} from '@payloadcms/db-postgres'
import config from '../../src/payload.config'
import {seedCommerce,seedLegacyOffer,commercialCollections} from '../fixtures/commerce'
import {atomic} from '../../src/modules/marketing/transaction'
import {up,down} from '../../migrations/20261024_231500_offer_identity_guard'

assert.equal(process.env.BIBLIOTHEON_SYNTHETIC_TESTS,'true','Exige banco sintético exclusivo.')
assert.ok(['127.0.0.1','localhost'].includes(new URL(process.env.DATABASE_URL || '').hostname))
const payload=await getPayload({config}),adapter=payload.db as unknown as PostgresAdapter,checks:string[]=[]
for(const collection of ['admin-users','offers','transactions'] as const)assert.equal((await payload.count({collection,overrideAccess:true})).totalDocs,0,'Migração exige fixture vazia.')
await assert.rejects(atomic(payload,async req=>{
 const id=await req.transactionID;assert.ok(id);const db=adapter.sessions[id].db
 await down({db,payload,req});await up({db,payload,req});throw new Error('synthetic migration rollback')
}),/synthetic migration rollback/)
checks.push('Migração up/down em banco sem ofertas e rollback transacional preservam a proteção; sem reescrever dados.')
const seed=await seedCommerce(),created:string[]=[],account='guard-synthetic',role='identity_fixture_'+randomUUID().replaceAll('-','')
const ident=sql.identifier(role)
const insert='INSERT INTO public.offers (id,name,provider,account_key,external_product_id,external_offer_id,ebook_id,currency,active) VALUES ($1,\'Fixture SQL\',$2,$3,$4,$5,$6,\'BRL\',false) RETURNING id'
const values=(product:string,ebook=seed.books[0].id,offer:string|null=null,scope={provider:'hotmart',accountKey:account})=>{
 const id=randomUUID();created.push(id);return[id,scope.provider,scope.accountKey,product,offer,ebook]
}
const code=(expected:string)=>(error:unknown)=>{
 let current=error as {code?:string;cause?:unknown}|undefined
 for(let i=0;current&&i<5;i++,current=current.cause as typeof current)if(current.code===expected)return true
 return false
}
const connectClient=()=>adapter.pool.connect()
const runtime=async<T>(fn:(client:Awaited<ReturnType<typeof connectClient>>)=>Promise<T>,isolation='READ COMMITTED')=>{
 const client=await adapter.pool.connect()
 try{await client.query('BEGIN ISOLATION LEVEL '+isolation);await client.query('SET LOCAL ROLE '+role);const result=await fn(client);await client.query('COMMIT');return result}
 catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}
const raw=(product:string,ebook=seed.books[0].id,offer:string|null=null,scope?:{provider:string;accountKey:string})=>runtime(client=>client.query(insert,values(product,ebook,offer,scope)))
const waiting=async(pid:number)=>{
 const deadline=Date.now()+5000
 while(Date.now()<deadline){
  const result=await adapter.pool.query("SELECT count(*)::int AS n FROM pg_locks waiter JOIN pg_locks holder USING (locktype,database,classid,objid,objsubid) WHERE waiter.locktype='advisory' AND NOT waiter.granted AND holder.granted AND holder.pid=$1",[pid])
  if(result.rows[0].n>0)return
  await new Promise(resolve=>setTimeout(resolve,10))
 }
 assert.fail('Bloqueio advisory concorrente não observado.')
}
try{
 await adapter.drizzle.execute(sql`CREATE ROLE ${ident} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE`)
 await adapter.drizzle.execute(sql`GRANT USAGE ON SCHEMA public TO ${ident}`)
 await adapter.drizzle.execute(sql`GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO ${ident}`)
 await adapter.drizzle.execute(sql`GRANT SELECT ON public.transactions TO ${ident}`)
 await assert.rejects(runtime(client=>client.query('ALTER TABLE public.offers DISABLE TRIGGER offers_identity_guard')),code('42501'))
 await raw('exact');await assert.rejects(raw('exact'),code('23514'));await assert.rejects(raw('exact',seed.books[0].id,''),code('23514'))
 await assert.rejects(raw('exact',seed.books[1].id,'other'),code('23514'))
 await raw('exact',seed.books[0].id,'offer-a');await raw('exact',seed.books[0].id,'offer-b');await assert.rejects(raw('exact',seed.books[0].id,'offer-a'),code('23514'))
 for(const provider of ['kiwify','cakto'])await raw('exact',seed.books[1].id,null,{provider,accountKey:account})
 await raw('exact',seed.books[1].id,null,{provider:'hotmart',accountKey:'guard-another'})
 await assert.rejects(runtime(client=>client.query(insert,values('fixed-snapshot')), 'REPEATABLE READ'),code('25001'))
 const other=(await raw('update-source')).rows[0].id as string
 await assert.rejects(runtime(client=>client.query('UPDATE offers SET external_product_id=$1 WHERE id=$2',['exact',other])),code('23514'))
 assert.equal((await adapter.pool.query('SELECT external_product_id FROM offers WHERE id=$1',[other])).rows[0].external_product_id,'update-source')
 await assert.rejects(runtime(client=>client.query('UPDATE offers SET ebook_id=NULL WHERE id=$1',[other])),code('23514'))
 const bulkValues=[...values('bulk-conflict'),...values('bulk-conflict')]
 await assert.rejects(runtime(client=>client.query("INSERT INTO offers (id,name,provider,account_key,external_product_id,external_offer_id,ebook_id,currency,active) VALUES ($1,'Bulk SQL',$2,$3,$4,$5,$6,'BRL',false),($7,'Bulk SQL',$8,$9,$10,$11,$12,'BRL',false)",bulkValues)),code('23514'))
 assert.equal((await adapter.pool.query('SELECT count(*)::int AS n FROM offers WHERE account_key=$1 AND external_product_id=$2',[account,'bulk-conflict'])).rows[0].n,0)
 checks.push('Papel runtime sem ownership/DDL não desativa trigger. SQL direto bloqueia duplicatas null/vazio, update conflitante, livro nulo e duplicação no mesmo INSERT com rollback integral; permite ofertas distintas e namespaces de Hotmart/Kiwify/Cakto/contas. Isolamento de snapshot fixo recusado explicitamente.')

 // Deterministic overlap: the second statement has already started before the first commits.
 for(const commit of [true,false]){
  const first=await adapter.pool.connect(),second=await adapter.pool.connect(),product=commit?'race-commit':'race-rollback'
  let pending:Promise<{ok:true}|{ok:false;error:unknown}>|undefined
  try{
   for(const client of [first,second]){await client.query('BEGIN');await client.query('SET LOCAL statement_timeout=10000');await client.query('SET LOCAL ROLE '+role)}
   const pid=(await first.query('SELECT pg_backend_pid() AS pid')).rows[0].pid as number
   await first.query(insert,values(product))
   pending=second.query(insert,values(product,seed.books[1].id)).then(()=>({ok:true as const}),error=>({ok:false as const,error}))
   await waiting(pid);await first.query(commit?'COMMIT':'ROLLBACK')
   const result=await pending
   if(commit){assert.equal(result.ok,false);if(!result.ok)assert.ok(code('23514')(result.error));await second.query('ROLLBACK')}
   else{assert.equal(result.ok,true);await second.query('COMMIT')}
  }finally{await first.query('ROLLBACK');await second.query('ROLLBACK');await pending;first.release();second.release()}
  assert.equal((await adapter.pool.query('SELECT count(*)::int AS n FROM offers WHERE account_key=$1 AND external_product_id=$2',[account,product])).rows[0].n,1)
 }
 checks.push('SQL concorrente observado em pg_locks: commit do primeiro faz segundo recusar com snapshot renovado; rollback permite segundo gravar. Um único registro após cada cenário.')

 const holder=await adapter.pool.connect();let api:Promise<{ok:true;id:string}|{ok:false;error:unknown}>|undefined
 try{
  await holder.query('BEGIN');const pid=(await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid as number
  await holder.query(insert,values('mixed-race'))
  api=payload.create({collection:'offers',...seed.auth,data:{name:'Concorrência API/SQL',provider:'hotmart',accountKey:account,externalProductId:'mixed-race',ebook:seed.books[1].id,currency:'BRL',active:false}}).then(offer=>{created.push(offer.id);return{ok:true as const,id:offer.id}},error=>({ok:false as const,error}))
  await waiting(pid);await holder.query('COMMIT');assert.equal((await api).ok,false)
 }finally{await holder.query('ROLLBACK');await api;holder.release()}
 // Special JSON characters must still produce exactly the account lock used by TypeScript.
 const special={provider:'hotmart',accountKey:'guard-"\\é'}
 const lock=await adapter.pool.connect()
 try{
  await lock.query('BEGIN');await lock.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['commercial-account:'+JSON.stringify([special.provider,special.accountKey])])
  const pid=(await lock.query('SELECT pg_backend_pid() AS pid')).rows[0].pid as number
  const pending=raw('special',seed.books[0].id,null,special).then(()=>true,()=>false)
  await waiting(pid);await lock.query('COMMIT');assert.equal(await pending,true)
 }finally{await lock.query('ROLLBACK');lock.release()}
 checks.push('SQL e API disputam a mesma barreira de conta; a API recusa associação divergente após commit SQL. Chave com aspas/barra/Unicode mantém compatibilidade JSON dos locks.')

 const original=(await adapter.pool.query('SELECT id FROM offers WHERE account_key=$1 AND external_product_id=$2 AND external_offer_id IS NULL',[account,'exact'])).rows[0].id as string
 await payload.create({collection:'transactions',overrideAccess:true,data:{key:'identity-history-'+randomUUID(),provider:'hotmart',accountKey:account,externalTransactionId:'synthetic-history',externalProductId:'exact',ebook:seed.books[0].id,offer:original,state:'unknown',currency:'BRL',needsReview:false}})
 const before=(await payload.find({collection:'transactions',overrideAccess:true,depth:0})).docs
 await assert.rejects(runtime(client=>client.query('UPDATE offers SET external_product_id=$1 WHERE id=$2',['replacement',original])),code('23514'))
 await assert.rejects(runtime(client=>client.query('DELETE FROM offers WHERE id=$1',[original])),code('23514'))
 await runtime(client=>client.query('UPDATE offers SET name=$1 WHERE id=$2',['Metadado preservado',original]))
 assert.deepEqual((await payload.find({collection:'transactions',overrideAccess:true,depth:0})).docs,before)
 checks.push('SQL não troca identidade nem apaga oferta com histórico; metadados permanecem editáveis e a transação original fica byte a byte preservada.')

 const legacy=await seedLegacyOffer(seed,{name:'Legado SQL sintético',provider:'hotmart',accountKey:account,externalProductId:'exact',ebook:seed.books[1].id,currency:'BRL',active:false});created.push(legacy.id)
 await runtime(client=>client.query('UPDATE offers SET name=$1 WHERE id=$2',['Legado conservado',legacy.id]))
 await assert.rejects(raw('exact',seed.books[0].id,'new-with-legacy'),code('23514'))
 const snapshot=(await adapter.pool.query('SELECT to_jsonb(o) AS row FROM offers o ORDER BY id')).rows
 await assert.rejects(atomic(payload,async req=>{
  const id=await req.transactionID;assert.ok(id);const db=adapter.sessions[id].db
  await db.execute(sql`DROP TRIGGER offers_identity_guard ON public.offers; DROP FUNCTION public.bibliotheon_offer_identity_guard(); DROP INDEX public.offers_external_product_idx;`)
  await up({db,payload,req})
  const restored=await db.execute(sql`SELECT to_jsonb(o) AS row FROM offers o ORDER BY id`)
  assert.deepEqual(restored.rows,snapshot);throw new Error('synthetic legacy upgrade rollback')
 }),/synthetic legacy upgrade rollback/)
 await assert.rejects(atomic(payload,async req=>{const id=await req.transactionID;assert.ok(id);await down({db:adapter.sessions[id].db,payload,req})}),/downgrade recusado/)
 checks.push('Upgrade sobre duplicatas legadas não reescreve ofertas; metadados legados editáveis, novas ambiguidades bloqueadas. Downgrade com ofertas recusa remoção silenciosa da proteção.')
}finally{
 for(const collection of commercialCollections)await payload.delete({collection,where:{id:{exists:true}},overrideAccess:true})
 if(created.length)await payload.delete({collection:'offers',where:{id:{in:created}},overrideAccess:true})
 await adapter.drizzle.execute(sql`DROP OWNED BY ${ident}; DROP ROLE ${ident}`)
 await seed.cleanup()
}
await mkdir('artifacts/catalog-identity-db',{recursive:true})
await writeFile('artifacts/catalog-identity-db/local-results.json',JSON.stringify({date:new Date().toISOString(),checks,externalCalls:false,migrations:22,limits:'PostgreSQL local/sintético com papel runtime efêmero; sem container/restore/HTTP/browser, resolução histórica auditada ou homologação externa.'},null,2)+'\n')
console.log(`Integridade SQL do catálogo: ${checks.length} grupos aprovados; fixtures/papel limpos.`)
process.exit(0)
