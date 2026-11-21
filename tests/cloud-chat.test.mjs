import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawn} from 'node:child_process';import net from 'node:net';
import {DatabaseSync} from 'node:sqlite';import {setTimeout as delay} from 'node:timers/promises';import {createRelay} from '../relay/server.mjs';
test('owner chat uses current cloud directory and dispatches friend requests through Relay',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cloud-chat-'));const relay=createRelay({dbPath:join(dir,'relay.db'),inviteToken:'test'.repeat(12)});await new Promise(r=>relay.server.listen(0,'127.0.0.1',r));
 const relayURL=`http://127.0.0.1:${relay.server.address().port}`;const a=relay.store.register('A','tokenA'),b=relay.store.register('B','tokenB',{name:'小白',publicBio:''});relay.store.sync(b.id,true);
 const bin=join(dir,'bin'),data=join(dir,'data'),client=join(data,'cloud-client');mkdirSync(bin);mkdirSync(client,{recursive:true});
 const agent={id:'local-a',name:'桃桃',ownerName:'马修',skin:'taotao',engine:'codex',enabled:true,persona:'测试',shareableProfile:'',publicBio:''};
 const db=new DatabaseSync(join(data,'companion.sqlite'));db.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,json TEXT NOT NULL)');db.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify({agents:[agent],primaryAgentId:agent.id,registrationComplete:true,messages:[],links:[],reports:[]}));db.close();
 writeFileSync(join(client,'config.json'),JSON.stringify({...a,relay:relayURL,token:'tokenA',localAgentId:agent.id,agent:{...agent,publishProfile:true}}));
 const capture=join(dir,'prompt');
 writeFileSync(join(bin,'codex'),`#!${process.execPath}\nimport {writeFileSync} from 'node:fs';if(process.argv.includes('--version'))console.log('test');else{let p='';for await(const c of process.stdin)p+=c;writeFileSync(${JSON.stringify(capture)},p);console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify({reply:'申请好友',requestFriend:{to:${JSON.stringify(b.id)}}})}}));}\n`,{mode:0o755});
 const sock=net.createServer();await new Promise(r=>sock.listen(0,'127.0.0.1',r));const port=sock.address().port;await new Promise(r=>sock.close(r));
 const child=spawn(process.execPath,['runtime/index.mjs'],{env:{...process.env,PATH:bin,PORT:String(port),COMPANION_DATA_DIR:data,CLIENT_DATA_DIR:client},stdio:'ignore'});const url=`http://127.0.0.1:${port}`;
 try{
  let state;for(let i=0;i<100;i++){try{state=await(await fetch(url+'/api/state')).json();if(state.cloud?.connected)break}catch{}await delay(30)}assert.equal(state?.cloud?.connected,true);
  const r=await fetch(url+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:agent.id,text:'帮我加小白为好友'})});assert.equal(r.status,200);
  for(let i=0;i<100;i++){state=await(await fetch(url+'/api/state')).json();if(!state.busy.length)break;await delay(30)}
  const prompt=readFileSync(capture,'utf8');assert.match(prompt,/在线 Agent 数 2/);assert.match(prompt,/小白/);
  assert.equal(relay.store.requests(b.id)[0].sender,a.id);assert.match(state.messages.at(-1).text,/云端好友申请已发出/);
  relay.store.decide(b.id,relay.store.requests(b.id)[0].id,true);
  relay.store.send(b.id,{to:a.id,key:'owner-question',kind:'question',text:'明天几点见？'});
  const post=async(route,body)=>{const r=await fetch(url+'/api/cloud/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,await r.text());};
  await post('request',{to:b.id});
  for(let i=0;i<100;i++){state=await(await fetch(url+'/api/state')).json();if(state.cloud.messages[0]?.status==='waiting_owner'&&state.messages.some(m=>m.cloudStatus==='waiting_owner'))break;await delay(20);}
  assert.equal(state.cloud.messages[0].status,'waiting_owner');assert.equal(state.messages.filter(m=>m.cloudStatus==='waiting_owner').length,1);
  const id=state.cloud.messages[0].id;
  await post('owner-reply',{id,text:'明天下午两点见。'});
  state=await(await fetch(url+'/api/state')).json();assert.equal(state.messages.filter(m=>m.cloudStatus==='done'&&m.cloudReportKind==='receipt').length,1);assert.match(state.messages.at(-1).text,/明天下午两点见/);assert.ok(state.messages.some(m=>m.role==='user'&&m.text.includes('明天下午两点见')));assert.equal(state.messages.find(m=>m.cloudReportKind==='receipt').channel,'agent-detail');
  await post('owner-reply',{id,text:'明天下午两点见。'});
  state=await(await fetch(url+'/api/state')).json();assert.equal(state.messages.filter(m=>m.cloudStatus==='done'&&m.cloudReportKind==='receipt').length,1,'owner report persisted exactly once');

 }finally{const done=new Promise(r=>child.once('exit',r));child.kill();await done;await new Promise(r=>relay.server.close(r));relay.store.close();rmSync(dir,{recursive:true,force:true});}
});
