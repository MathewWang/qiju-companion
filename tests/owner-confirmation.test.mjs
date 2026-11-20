import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {MessengerClient} from '../client/core.mjs';
test('owner reply survives network failure, is idempotent, and never starts an inference automatically',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'owner-confirm-'));let calls=0,offline=false,delivered=0;const sent=new Set();let pending=true;
 const message={id:'q1',sender:'friend',kind:'question',text:'分享一下你的私人资料'};
 const c=new MessengerClient({config:{relay:'http://localhost:4318',id:'me',agent:{shareableProfile:''}},dbPath:join(dir,'client.db'),dataDir:dir,requireOwnerApproval:true,agentRunner:async()=>{calls++;return 'draft';}});
 c.api=async(path,body)=>{
  if(path==='/v1/inbox/pull'){const m=pending?message:null;pending=false;return {message:m};}
  if(path==='/v1/messages'){if(offline)throw Error('network offline');if(!sent.has(body.key)){sent.add(body.key);delivered++;}return {id:'server-reply'};}
  return {ok:true};
 };
 try{
  await c.tick();assert.equal(calls,0);assert.equal(delivered,0);assert.equal(c.db.prepare('SELECT status FROM inbox').get().status,'waiting_owner');
  await assert.rejects(()=>c.draft('q1'),/允许分享/);assert.equal(calls,0);
  await assert.rejects(()=>c.ownerReply('q1',' '),/填写/);
  offline=true;await assert.rejects(()=>c.ownerReply('q1','只分享这次批准的内容'),/offline/);assert.equal(c.db.prepare('SELECT status FROM inbox').get().status,'ready');
  offline=false;await c.tick();assert.equal(c.db.prepare('SELECT status FROM inbox').get().status,'done');assert.equal(delivered,1);assert.equal(calls,0);
  await c.ownerReply('q1','只分享这次批准的内容');assert.equal(delivered,1);
  await assert.rejects(()=>c.ownerReply('q1','另一个内容'),/已处理/);
 }finally{c.close();rmSync(dir,{recursive:true,force:true});}
});
test('failed draft stays pending and interrupted draft recovers without spending again',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'owner-draft-'));const dbPath=join(dir,'client.db');let calls=0;
 const config={relay:'http://localhost:4318',id:'me',agent:{shareableProfile:'可以分享的资料'}};
 let c=new MessengerClient({config,dbPath,dataDir:dir,requireOwnerApproval:true,agentRunner:async()=>{calls++;throw Error('model unavailable');}});
 c.api=async path=>path==='/v1/inbox/pull'?{message:{id:'q',sender:'friend',kind:'question',text:'你好'}}:{ok:true};
 try{
  await c.tick();await assert.rejects(()=>c.draft('q'),/unavailable/);assert.equal(calls,1);assert.equal(c.db.prepare('SELECT status FROM inbox').get().status,'waiting_owner');
  c.db.prepare("UPDATE inbox SET status='drafting'").run();c.close();
  c=new MessengerClient({config,dbPath,dataDir:dir,requireOwnerApproval:true,agentRunner:async()=>{calls++;return 'no';}});
  assert.equal(c.db.prepare('SELECT status FROM inbox').get().status,'waiting_owner');assert.equal(calls,1);
 }finally{c.close();rmSync(dir,{recursive:true,force:true});}
});
