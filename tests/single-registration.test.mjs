import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
test('single-agent registration needs explicit consents, verifies once and persists one owner',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'single-registration-'));const bin=join(dir,'bin');mkdirSync(bin);
 const marker=join(dir,'calls');
 // Isolated fake CLI: this test never contacts a model or uses credentials.
 writeFileSync(join(bin,'codex'),`#!${process.execPath}\nimport {appendFileSync} from 'node:fs';\nif(process.argv.includes('--version'))console.log('test-codex');else{appendFileSync(${JSON.stringify(marker)},'call\\n');console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'connected'}}));}\n`,{mode:0o755});
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PATH:bin,PORT:String(port),COMPANION_DATA_DIR:join(dir,'data')},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
 const url=`http://127.0.0.1:${port}`;
 const post=async data=>{const r=await fetch(url+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};};
 const agent={name:'Only Agent',ownerName:'Owner',skin:'taotao',engine:'codex',autoAcceptFriends:false,publishProfile:true};
 try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(url+'/api/state')).ok){ready=true;break}}catch{}await delay(50)}assert.ok(ready,logs);
  assert.equal((await post({agent})).status,400);assert.equal(existsSync(marker),false);
  assert.equal((await post({agent:{...agent,publishProfile:false},verifyConnection:true})).status,400);assert.equal(existsSync(marker),false);
  assert.equal((await post({verifyConnection:true})).status,400);
  const result=await post({agent,verifyConnection:true});assert.equal(result.status,200,JSON.stringify(result.body));
  const state=await (await fetch(url+'/api/state')).json();assert.equal(state.agents.length,1);assert.equal(state.registrationComplete,true);assert.equal(state.primaryAgentId,state.agents[0].id);assert.equal(state.agents[0].autoAcceptFriends,false);assert.ok(state.agents[0].verifiedAt);assert.equal(state.links.length,0);
  assert.equal((await post({agent,verifyConnection:true})).status,400);assert.equal(readFileSync(marker,'utf8'),'call\n');
 }finally{const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;rmSync(dir,{recursive:true,force:true});}
});
