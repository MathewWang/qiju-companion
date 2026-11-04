import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {normalizeAgent,registrationPayload} from '../shared/agent-profile.mjs';
import {RelayStore} from '../relay/store.mjs';
import {createRelay} from '../relay/server.mjs';
const agent={name:' 知交 ',ownerName:'私有称呼',engine:'codex',persona:'私人性格',shareableProfile:'私人近况',publicBio:'交流技术',publishProfile:true};
test('registration requires consent, validates local fields, and projects only explicit public fields',()=>{
 assert.throws(()=>normalizeAgent({...agent,publishProfile:false}),/公开范围/);
 for(const patch of [{name:' '},{ownerName:12},{engine:'shell'},{persona:'x'.repeat(2001)},{engine:'opencode',model:''}])assert.throws(()=>normalizeAgent({...agent,...patch}));
 assert.deepEqual(registrationPayload(' 电脑甲 ',agent),{name:'电脑甲',publishProfile:true,profile:{name:'知交',publicBio:'交流技术'}});
 assert.throws(()=>registrationPayload(' ',agent));
});
test('legacy databases migrate without losing devices or changing authentication',()=>{
 const dir=mkdtempSync(join(tmpdir(),'profile-migration-'));const path=join(dir,'db');
 const old=new DatabaseSync(path);old.exec('CREATE TABLE devices(id TEXT PRIMARY KEY,token_hash TEXT UNIQUE NOT NULL,name TEXT NOT NULL,created_at INTEGER NOT NULL)');old.close();
 let store=new RelayStore(path);
 try{const d=store.register('旧设备','old');store.close();store=new RelayStore(path);assert.equal(store.authenticate('old').id,d.id);assert.deepEqual(store.directory(),[d]);}finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('Relay rejects private fields and unapproved cards before issuing a device; cards persist',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'profile-relay-'));const path=join(dir,'db');const invite='test-only'.repeat(8);
 const relay=createRelay({dbPath:path,inviteToken:invite});await new Promise(r=>relay.server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${relay.server.address().port}`;
 const register=async body=>fetch(url+'/v1/devices',{method:'POST',headers:{Authorization:`Bearer ${invite}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
 let device;
 try{
  const payload=registrationPayload('电脑甲',agent);
  assert.equal((await register({...payload,publishProfile:false})).status,400);
  assert.equal((await register({...payload,profile:{...payload.profile,persona:'private'}})).status,400);
  assert.equal(relay.store.directory().length,0);
  const response=await register(payload);assert.equal(response.status,201);device=await response.json();
  const directory=await (await fetch(url+'/v1/directory',{headers:{Authorization:`Bearer ${device.token}`}})).json();
  assert.deepEqual(directory,[{id:device.id,name:'电脑甲',profile:{name:'知交',publicBio:'交流技术'}}]);
 }finally{await new Promise(r=>relay.server.close(r));relay.store.close();}
 const store=new RelayStore(path);try{assert.equal(store.authenticate(device.token).id,device.id);assert.equal(store.directory()[0].profile.name,'知交');}finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
