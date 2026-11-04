import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRelay} from '../relay/server.mjs';
import {MessengerClient,validateRelayURL} from '../client/core.mjs';
test('authenticated cross-device delivery, friend approval, isolation, persistence and deduplication',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'zhijiao-'));const invite='test-invite-'.repeat(4);const path=join(dir,'relay.sqlite');
 const relay=createRelay({dbPath:path,inviteToken:invite});await new Promise(r=>relay.server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${relay.server.address().port}`;
 const api=async(token,path,body)=>{const r=await fetch(url+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 let a,b;
 try{
  assert.equal((await api('invalid','/v1/directory')).status,401);
  assert.equal((await api('invalid','/v1/devices',{name:'bad'})).status,401);
  a=(await api(invite,'/v1/devices',{name:'电脑甲'})).data;b=(await api(invite,'/v1/devices',{name:'电脑乙'})).data;
  const third=(await api(invite,'/v1/devices',{name:'电脑丙'})).data;
  assert.equal((await api(a.token,'/v1/messages',{to:b.id,key:'blocked',kind:'question',text:'hi'})).status,400);
  const request=(await api(a.token,'/v1/requests',{to:b.id})).data;
  assert.equal((await api(a.token,'/v1/requests/decision',{id:request.id,accept:true})).status,400);
  assert.equal((await api(b.token,'/v1/requests/decision',{id:request.id,accept:true})).status,200);
  const directory=(await api(a.token,'/v1/directory')).data;assert.deepEqual(Object.keys(directory[0]).sort(),['id','name']);
  let calls=0;
  const ca=new MessengerClient({config:{relay:url,...a},dbPath:join(dir,'a.sqlite'),dataDir:dir});
  const cb=new MessengerClient({config:{relay:url,...b,agent:{name:'助理乙',engine:'codex',shareableProfile:'允许分享'}},dbPath:join(dir,'b.sqlite'),dataDir:dir,agentRunner:async x=>{calls++;assert.equal(x.message,'你好');return '收到';}});
  try{
   ca.queue(b.id,'你好','question',null,'one');await ca.flush();
   const dup=await api(a.token,'/v1/messages',{to:b.id,text:'你好',kind:'question',key:'one'});assert.equal(dup.status,200);
   assert.equal((await api(a.token,'/v1/messages',{to:b.id,text:'changed',kind:'question',key:'one'})).status,400);
   assert.equal((await api(third.token,'/v1/inbox/ack',{id:dup.data.id})).status,400);
   assert.equal((await api(third.token,'/v1/inbox/pull',{})).data.message,null);
   await cb.tick();assert.equal(calls,1);await cb.tick();assert.equal(calls,1);
   await ca.tick();assert.equal(ca.db.prepare('SELECT json FROM inbox').get().json.includes('收到'),true);
   assert.equal(relay.store.db.prepare('SELECT count(*) AS n FROM messages').get().n,2);
   // Simulate lost ACK: expired lease redelivers but local result prevents another model call.
   relay.store.db.prepare('UPDATE messages SET acknowledged_at=NULL,lease_until=0 WHERE id=?').run(dup.data.id);
   await cb.tick();assert.equal(calls,1);
  }finally{ca.close();cb.close();}
  assert.equal((await api(a.token,'/v1/messages',{to:b.id,key:'forged',kind:'reply',text:'bad',replyTo:'missing'})).status,400);
 }finally{await new Promise(r=>relay.server.close(r));relay.store.close();}
 const reopened=createRelay({dbPath:path,inviteToken:invite});try{assert.equal(reopened.store.authenticate(a.token).id,a.id);assert.equal(reopened.store.friends(a.id,b.id),true);}finally{reopened.store.close();rmSync(dir,{recursive:true,force:true});}
});
test('ready responses survive failed network delivery without repeating model work',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'zhijiao-client-'));let calls=0;
 const c=new MessengerClient({config:{relay:'http://localhost:4318',id:'b',agent:{}},dbPath:join(dir,'c.sqlite'),dataDir:dir,agentRunner:async()=>{calls++;return 'answer';}});
 const m={id:'m',sender:'a',recipient:'b',text:'question',kind:'question'};
 let fail=true;let pulls=0;
 c.api=async(path)=>{if(path==='/v1/inbox/pull'){pulls++;return {message:m};}if(path==='/v1/messages'&&fail)throw Error('offline');return {ok:true};};
 try{await assert.rejects(()=>c.tick(),/offline/);assert.equal(calls,1);fail=false;await c.tick();assert.equal(calls,1);assert.equal(c.db.prepare('SELECT status FROM inbox').get().status,'done');assert.equal(pulls,2);}finally{c.close();rmSync(dir,{recursive:true,force:true});}
});
test('public endpoints require TLS and reject credential-bearing or redirected base URLs',()=>{
 assert.throws(()=>validateRelayURL('http://example.com'));
 assert.throws(()=>validateRelayURL('https://user:pass@example.com'));
 assert.throws(()=>validateRelayURL('https://example.com/path'));
 assert.equal(validateRelayURL('https://example.com'),'https://example.com');
});
test('model failures are recorded and not silently retried; explicit retry works',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'zhijiao-failed-'));let calls=0;let fail=true;
 const c=new MessengerClient({config:{relay:'http://localhost:4318',id:'b',agent:{}},dbPath:join(dir,'c.sqlite'),dataDir:dir,agentRunner:async()=>{calls++;if(fail)throw Error('model unavailable');return 'recovered';}});
 const m={id:'failed-message',sender:'a',recipient:'b',text:'question',kind:'question'};
 c.api=async(path)=>path==='/v1/inbox/pull'?{message:m}:{ok:true};
 try{
  await c.tick();assert.equal(c.db.prepare('SELECT status,error FROM inbox').get().error,'model unavailable');
  await c.tick();assert.equal(calls,1);
  fail=false;await c.retry(m.id);assert.equal(calls,2);assert.equal(c.db.prepare('SELECT status FROM inbox').get().status,'done');
 }finally{c.close();rmSync(dir,{recursive:true,force:true});}
});
