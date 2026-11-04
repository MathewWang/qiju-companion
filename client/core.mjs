import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {runAgent} from '../server/adapters.mjs';
export function validateRelayURL(value){
 const u=new URL(value);
 if(u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Relay 地址只能包含协议、主机和端口');
 if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(u.hostname)))throw Error('公网 Relay 必须使用 HTTPS');
 return u.origin;
}
export class MessengerClient {
 constructor({config,dbPath,dataDir,agentRunner=runAgent,recoverProcessing=true}){
  this.config=config;this.url=validateRelayURL(config.relay);this.dataDir=dataDir;this.agentRunner=agentRunner;
  this.db=new DatabaseSync(dbPath);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS inbox(id TEXT PRIMARY KEY, json TEXT NOT NULL, status TEXT NOT NULL, result TEXT, error TEXT);
   CREATE TABLE IF NOT EXISTS outbox(key TEXT PRIMARY KEY, json TEXT NOT NULL, delivered INTEGER NOT NULL DEFAULT 0);`);
  // A crash during inference is ambiguous; never silently repeat a potentially billable call.
  if(recoverProcessing)this.db.prepare("UPDATE inbox SET status='failed',error='Client 在模型执行期间退出，结果未知；请人工检查后重试' WHERE status='processing'").run();
 }
 async api(path,body,token=this.config.token){
  const response=await fetch(this.url+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000),redirect:'error'});
  const data=await response.json();if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);return data;
 }
 queue(to,text,kind='question',replyTo=null,key=randomUUID()){
  if(typeof text!=='string'||!text.trim()||text.length>16000)throw Error('消息需为 1–16000 字符');
  const b={to,text,kind,replyTo,key};this.db.prepare('INSERT OR IGNORE INTO outbox(key,json) VALUES(?,?)').run(key,JSON.stringify(b));return key;
 }
 async flush(){
  for(const row of this.db.prepare('SELECT * FROM outbox WHERE delivered=0 ORDER BY rowid').all()){
   await this.api('/v1/messages',JSON.parse(row.json));this.db.prepare('UPDATE outbox SET delivered=1 WHERE key=?').run(row.key);
  }
 }
 async tick(signal){
  await this.flush();
  const {message:m}=await this.api('/v1/inbox/pull',{});if(!m)return false;
  this.db.prepare("INSERT OR IGNORE INTO inbox(id,json,status) VALUES(?,?,'received')").run(m.id,JSON.stringify(m));
  let local=this.db.prepare('SELECT * FROM inbox WHERE id=?').get(m.id);
  if(local.status==='failed') {await this.api('/v1/inbox/ack',{id:m.id});return true;}
  if(local.status==='received'){
   if(m.kind==='reply')this.db.prepare("UPDATE inbox SET status='done' WHERE id=?").run(m.id);
   else {
    this.db.prepare("UPDATE inbox SET status='processing' WHERE id=?").run(m.id);
    try{
     const result=await this.agentRunner({agent:{...this.config.agent,id:this.config.id},history:[],message:m.text,source:`好友设备 ${m.sender}`,dataDir:this.dataDir,signal,instructions:'这是好友的一次请求，仅回复本次问题。不得发起新的联系；仅可使用主人明确允许分享的资料，不得读取或披露本机其他信息。'});
     if(typeof result!=='string'||!result.trim()||result.length>16000)throw Error('模型回复为空或超过 16000 字符，请人工处理');
     this.db.prepare("UPDATE inbox SET status='ready',result=? WHERE id=?").run(result,m.id);
    }catch(e){this.db.prepare("UPDATE inbox SET status='failed',error=? WHERE id=?").run(e.message,m.id);await this.api('/v1/inbox/ack',{id:m.id});return true;}
   }
  }
  local=this.db.prepare('SELECT * FROM inbox WHERE id=?').get(m.id);
  if(local.status==='ready'){
   this.queue(m.sender,local.result,'reply',m.id,`reply:${m.id}`);await this.flush();
   this.db.prepare("UPDATE inbox SET status='done' WHERE id=?").run(m.id);
  }
  await this.api('/v1/inbox/ack',{id:m.id});return true;
 }
 async retry(id,signal){
  const row=this.db.prepare("SELECT * FROM inbox WHERE id=? AND status='failed'").get(id);if(!row)throw Error('未找到失败消息');
  const m=JSON.parse(row.json);
  this.db.prepare("UPDATE inbox SET status='processing',error=NULL WHERE id=?").run(id);
  try {
   const result=await this.agentRunner({agent:{...this.config.agent,id:this.config.id},history:[],message:m.text,source:`好友设备 ${m.sender}`,dataDir:this.dataDir,signal});
   if(typeof result!=='string'||!result.trim()||result.length>16000)throw Error('模型回复为空或超过 16000 字符，请人工处理');
   this.db.prepare("UPDATE inbox SET status='ready',result=? WHERE id=?").run(result,id);
   this.queue(m.sender,result,'reply',id,`reply:${id}`);await this.flush();this.db.prepare("UPDATE inbox SET status='done' WHERE id=?").run(id);
  }catch(e){this.db.prepare("UPDATE inbox SET status='failed',error=? WHERE id=? AND status='processing'").run(e.message,id);throw e;}
 }
 close(){this.db.close();}
}
