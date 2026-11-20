import {mkdirSync,existsSync,readFileSync,writeFileSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {MessengerClient,validateRelayURL} from '../client/core.mjs';
import {normalizeAgent,normalizePublicProfile} from '../shared/agent-profile.mjs';

// Credentials stay on the loopback server. Renderers receive only this public snapshot.
export class DesktopCloud {
 constructor({dir,getAgent,onChange=()=>{},agentRunner}){
  this.dir=dir;this.getAgent=getAgent;this.onChange=onChange;this.agentRunner=agentRunner;
  mkdirSync(dir,{recursive:true,mode:0o700});this.path=join(dir,'config.json');this.lock=join(dir,'client.lock');
  this.state={registered:false,connected:false,directory:[],friends:[],requests:[],visits:[],messages:[]};
  this.abort=new AbortController();this.closed=false;
  if(existsSync(this.path)){
   const c=JSON.parse(readFileSync(this.path,'utf8'));
   if(c.localAgentId){this.config=c;this.state.registered=true;this.state.deviceId=c.id;this.state.agentId=c.localAgentId;}
  }
 }
 snapshot(){return this.state;}
 publish(patch){Object.assign(this.state,patch);this.onChange();}
 save(){writeFileSync(this.path,JSON.stringify(this.config,null,2),{mode:0o600});}
 async connect({agentId,relay='https://agentmen.cn',deviceName,inviteToken,publishProfile}){
  if(publishProfile!==true)throw Error('请确认公开设备名、助理名字、形象和简介');
  const agent=this.getAgent(agentId);if(!agent)throw Error('请先创建本机助理');
  if(this.client)throw Error('云端已配置，请使用现有身份');
  // Take the same lock as the headless daemon before adopting its identity.
  try{this.fd=openSync(this.lock,'wx',0o600);}catch{throw Error('无头 Client 正在运行，请先停止它再连接桌面版');}
  try{
   const local=normalizeAgent({...agent,publishProfile:true});const url=validateRelayURL(relay);
   if(existsSync(this.path)){
    this.config=JSON.parse(readFileSync(this.path,'utf8'));
    if(this.config.relay!==url)throw Error('现有 Client 属于其他服务器，请保留原配置并使用独立数据目录');
    if(this.config.localAgentId&&this.config.localAgentId!==agentId)throw Error('现有身份已绑定另一位本机助理');
   }else{
    if(typeof inviteToken!=='string'||!inviteToken)throw Error('首次连接需要注册邀请码');
    const r=await fetch(url+'/v1/devices',{method:'POST',headers:{Authorization:`Bearer ${inviteToken}`,'Content-Type':'application/json'},body:JSON.stringify({name:deviceName,publishProfile:true,profile:this.profile(agent)}),signal:AbortSignal.timeout(15000),redirect:'error'});
    const d=await r.json();if(!r.ok)throw Error(d.error||'注册失败');
    this.config={relay:url,...d,agent:local};this.save();
   }
   this.config.localAgentId=agentId;this.config.agent=local;this.save();
   this.client=new MessengerClient({config:this.config,dbPath:join(this.dir,'client.sqlite'),dataDir:this.dir,agentRunner:this.agentRunner});
   this.publish({registered:true,deviceId:this.config.id,agentId});
   await this.client.api('/v1/profile',{profile:this.profile(agent),publishProfile:true});
   this.profileJSON=JSON.stringify(this.profile(agent));
   await this.poll();
  }catch(e){if(!this.client)this.unlock();throw e;}
 }
 profile(agent){return normalizePublicProfile({name:agent.name,publicBio:agent.publicBio||'',skin:agent.skin});}
 unlock(){if(this.fd!==undefined){closeSync(this.fd);this.fd=undefined;unlinkSync(this.lock);}}
 async start(){
  if(!this.config||this.client||this.closed)return;
  try{
   this.fd=openSync(this.lock,'wx',0o600);
   this.client=new MessengerClient({config:this.config,dbPath:join(this.dir,'client.sqlite'),dataDir:this.dir,agentRunner:this.agentRunner});
  }catch(e){this.publish({error:e.code==='EEXIST'?'Client 数据目录被其他进程占用':e.message});return;}
  await this.poll();
 }
 async poll(){
  if(!this.client||this.polling||this.closed)return;this.polling=true;
  try{
   const agent=this.getAgent(this.config.localAgentId);if(!agent)throw Error('绑定的本机助理不存在');
   this.config.agent=normalizeAgent({...agent,publishProfile:true});
   const card=JSON.stringify(this.profile(agent));
   if(card!==this.profileJSON){await this.client.api('/v1/profile',{profile:JSON.parse(card),publishProfile:true});this.profileJSON=card;this.save();}
   const data=await this.client.api('/v1/sync',{online:agent.enabled});
   this.publish({...data,connected:true,error:''});
   if(agent.enabled&&!this.processing){
    this.processing=this.client.tick(this.abort.signal).catch(e=>this.publish({error:e.message})).finally(()=>{this.processing=null;if(!this.closed)this.refreshMessages();});
   }
   this.refreshMessages();
  }catch(e){this.publish({connected:false,error:e.message});}finally{this.polling=false;}
 }
 refreshMessages(){
  const incoming=this.client.db.prepare('SELECT id,json,status,error,result FROM inbox ORDER BY rowid DESC LIMIT 50').all().map(r=>({...r,message:JSON.parse(r.json),json:undefined}));
  this.publish({messages:incoming});
 }
 async action(path,body){
  if(!this.client)throw Error('请先连接云端');
  const routes={request:'/v1/requests',decision:'/v1/requests/decision',visit:'/v1/visits','visit-action':'/v1/visits/action'};
  if(path==='message'){
   const agent=this.getAgent(this.config.localAgentId);if(!agent?.enabled)throw Error('请先让助理上线');
   this.client.queue(body.to,body.text);await this.client.flush();
  }else{
   if(!routes[path])throw Error('未知云端操作');await this.client.api(routes[path],body);
  }
  await this.poll();
 }
 async close(){
  this.closed=true;this.abort.abort();
  try{if(this.client)await this.client.api('/v1/sync',{online:false});}catch{}
  await this.processing;
  if(this.client)this.client.close();this.unlock();
 }
}
