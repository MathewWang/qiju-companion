import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createVisit,actOnVisit,expireVisits,VISIT_ACTIVE_MS,VISIT_PENDING_MS} from '../shared/visits.mjs';
import {createRelay} from '../relay/server.mjs';
import {RelayStore} from '../relay/store.mjs';
const make=(list,from='a',to='b',key='one',now=100)=>createVisit(list,{from,to,key,note:'hello'},()=>true,now);
test('visits enforce friendship, participant roles, idempotency and one active guest',()=>{
 const list=[];
 assert.throws(()=>createVisit(list,{from:'a',to:'b',key:'x',note:'hello'},()=>false));
 assert.throws(()=>createVisit(list,{from:'a',to:'b',key:'x',note:'hello',url:'javascript:alert(1)'},()=>true));
 const v=make(list);assert.equal(make(list).id,v.id);assert.throws(()=>make(list,'a','b','two'));
 assert.throws(()=>actOnVisit(list,{id:v.id,actor:'a',action:'accept'},101));assert.throws(()=>actOnVisit(list,{id:v.id,actor:'stranger',action:'end'},101));
 actOnVisit(list,{id:v.id,actor:'b',action:'accept'},102);const deadline=v.expiresAt;
 actOnVisit(list,{id:v.id,actor:'b',action:'accept'},103);assert.equal(v.expiresAt,deadline);
 const second=make(list,'c','b','two',103);assert.throws(()=>actOnVisit(list,{id:second.id,actor:'b',action:'accept'},104));
 actOnVisit(list,{id:v.id,actor:'b',action:'end',reply:'thanks'},105);assert.equal(v.reply,'thanks');
 actOnVisit(list,{id:v.id,actor:'b',action:'end',reply:'thanks'},106);assert.throws(()=>actOnVisit(list,{id:v.id,actor:'b',action:'end',reply:'changed'},107));
 actOnVisit(list,{id:second.id,actor:'b',action:'accept'},108);assert.equal(second.status,'active');
});
test('offline invitations expire, active visits time out, and cancellation cannot resurrect a guest',()=>{
 const list=[];const v=make(list);expireVisits(list,100+VISIT_PENDING_MS);assert.equal(v.status,'expired');assert.throws(()=>actOnVisit(list,{id:v.id,actor:'b',action:'accept'},101+VISIT_PENDING_MS));
 const current=make(list,'a','b','new',100+VISIT_PENDING_MS);actOnVisit(list,{id:current.id,actor:'b',action:'accept'},101+VISIT_PENDING_MS);expireVisits(list,101+VISIT_PENDING_MS+VISIT_ACTIVE_MS);assert.equal(current.status,'expired');
 const cancelled=make(list,'a','b','cancel',Date.now());actOnVisit(list,{id:cancelled.id,actor:'a',action:'cancel'});actOnVisit(list,{id:cancelled.id,actor:'a',action:'cancel'});assert.throws(()=>actOnVisit(list,{id:cancelled.id,actor:'b',action:'accept'}));
 const declined=make(list,'a','b','decline',Date.now());actOnVisit(list,{id:declined.id,actor:'b',action:'decline'});assert.equal(declined.status,'declined');
});
test('Relay persists visits, isolates participants, and authenticates actions rather than trusting body actor',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'visits-'));const path=join(dir,'db');const invite='test-only'.repeat(8);
 const relay=createRelay({dbPath:path,inviteToken:invite});await new Promise(r=>relay.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${relay.server.address().port}`;
 const api=async(token,path,body)=>{const r=await fetch(url+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()}};
 let a,b,v;
 try{
  a=(await api(invite,'/v1/devices',{name:'A'})).data;b=(await api(invite,'/v1/devices',{name:'B'})).data;const c=(await api(invite,'/v1/devices',{name:'C'})).data;
  assert.equal((await api(a.token,'/v1/visits',{to:b.id,note:'hello',key:'one'})).status,400);
  const request=(await api(a.token,'/v1/requests',{to:b.id})).data;await api(b.token,'/v1/requests/decision',{id:request.id,accept:true});
  v=(await api(a.token,'/v1/visits',{to:b.id,note:'hello',key:'one'})).data;
  assert.equal((await api(b.token,'/v1/visits')).data[0].status,'pending');assert.deepEqual((await api(c.token,'/v1/visits')).data,[]);
  assert.equal((await api(c.token,'/v1/visits/action',{id:v.id,actor:b.id,action:'accept'})).status,400);
  assert.equal((await api(a.token,'/v1/visits/action',{id:v.id,actor:b.id,action:'accept'})).status,400);
  assert.equal((await api(b.token,'/v1/visits/action',{id:v.id,action:'accept'})).data.status,'active');
  assert.equal((await api(b.token,'/v1/visits/action',{id:v.id,action:'end',reply:'thanks'})).data.reply,'thanks');
 }finally{await new Promise(r=>relay.server.close(r));relay.store.close()}
 const store=new RelayStore(path);try{assert.equal(store.visits(a.id)[0].reply,'thanks');assert.equal(store.visits(b.id)[0].status,'ended')}finally{store.close();rmSync(dir,{recursive:true,force:true})}
});
