import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRelay} from '../relay/server.mjs';
import {DesktopCloud} from '../server/cloud.mjs';
const agent=id=>({id,name:id,ownerName:'私有主人',engine:'codex',skin:'taotao',publicBio:'公开简介',persona:'私有性格',shareableProfile:'私有资料',enabled:true});
test('two desktops adopt identity, discover presence, approve friendship, visit, deliver and reply without exposing secrets',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'desktop-cloud-'));const invite='test-invite'.repeat(4);
 const relay=createRelay({dbPath:join(dir,'relay.sqlite'),inviteToken:invite});await new Promise(r=>relay.server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${relay.server.address().port}`;
 const a=agent('桃桃'),b=agent('小白');const adir=join(dir,'a');mkdirSync(adir);
 const device=relay.store.register('电脑A','existing-token');
 writeFileSync(join(adir,'config.json'),JSON.stringify({...device,token:'existing-token',relay:url,agent:{...a,publishProfile:true}}));
 let calls=0;
 const ca=new DesktopCloud({dir:adir,getAgent:id=>id===a.id?a:null,agentRunner:async()=>{calls++;return '收到啦';}});
 const cb=new DesktopCloud({dir:join(dir,'b'),getAgent:id=>id===b.id?b:null,agentRunner:async()=>{calls++;return '收到啦';}});
 try{
  await assert.rejects(()=>ca.connect({agentId:a.id,relay:url,publishProfile:false}),/公开/);
  await ca.connect({agentId:a.id,relay:url,publishProfile:true});assert.equal(ca.snapshot().deviceId,device.id);
  await cb.connect({agentId:b.id,relay:url,deviceName:'电脑B',inviteToken:invite,publishProfile:true});
  await ca.poll();assert.equal(ca.snapshot().directory.filter(d=>d.online).length,2);assert.equal(relay.store.directory().length,2);
  assert.equal(ca.snapshot().directory.find(d=>d.id===device.id).profile.name,'桃桃');
  const publicJSON=JSON.stringify(ca.snapshot());for(const privateText of ['existing-token','私有主人','私有性格','私有资料'])assert.equal(publicJSON.includes(privateText),false);
  const bid=cb.snapshot().deviceId;
  await ca.action('request',{to:bid});await cb.poll();const request=cb.snapshot().requests[0];
  await assert.rejects(()=>ca.action('decision',{id:request.id,accept:true}),/接收方/);
  await cb.action('decision',{id:request.id,accept:true});await ca.poll();assert.deepEqual(ca.snapshot().friends,[bid]);
  await ca.action('visit',{to:bid,note:'我来做客',key:'visit-one'});await cb.poll();const visit=cb.snapshot().visits[0];
  await cb.action('visit-action',{id:visit.id,action:'accept'});await ca.poll();assert.equal(ca.snapshot().visits[0].status,'active');
  assert.equal(calls,0,'visits do not invoke models');
  await cb.action('visit-action',{id:visit.id,action:'end',reply:'下次见'});await ca.poll();assert.equal(ca.snapshot().visits[0].reply,'下次见');
  await ca.action('message',{to:bid,text:'你好'});await ca.processing;await cb.processing;await cb.poll();await cb.processing;
  await ca.poll();await ca.processing;assert.equal(calls,1);assert.equal(ca.snapshot().messages[0].message.text,'收到啦');
  b.enabled=false;await cb.poll();await ca.poll();assert.equal(ca.snapshot().directory.find(d=>d.id===bid).online,false);
  const now=Date.now();relay.store.sync(bid,true,now);assert.equal(relay.store.sync(device.id,true,now+75001).directory.find(d=>d.id===bid).online,false);
 }finally{await ca.close();await cb.close();await new Promise(r=>relay.server.close(r));relay.store.close();rmSync(dir,{recursive:true,force:true});}
});
test('desktop refuses data already owned by headless daemon',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'desktop-lock-'));writeFileSync(join(dir,'client.lock'),'');
 const c=new DesktopCloud({dir,getAgent:()=>agent('a')});try{await assert.rejects(()=>c.connect({agentId:'a',publishProfile:true}),/正在运行/);}finally{await c.close();rmSync(dir,{recursive:true,force:true});}
});
