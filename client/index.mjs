import {mkdirSync,readFileSync,writeFileSync,existsSync,chmodSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {normalizeAgent,registrationPayload} from '../shared/agent-profile.mjs';
import {MessengerClient,validateRelayURL} from './core.mjs';
const dir=resolve(process.env.CLIENT_DATA_DIR||'.data/client');
const configPath=join(dir,'config.json');
const [command,...args]=process.argv.slice(2);
const usage=`知交信使 · 无头 Client
  init <https://relay.example.com> <公开设备名>  # CLIENT_INVITE_TOKEN 环境变量；CLIENT_AGENT_FILE 指向本机角色 JSON
  check                                      # 校验本地角色并预览公开资料，不注册、不调用模型
  directory                                  # 查看邀请制目录
  request <设备ID>                            # 申请好友
  requests                                   # 查看申请
  accept|decline <申请ID>                      # 接收方批准/拒绝
  send <好友设备ID> <消息>                     # 本地持久入队并投递
  inbox                                      # 查看收到的请求、回复和错误
  retry <失败消息ID>                          # 明确重试模型调用，可能产生用量
  run                                        # 后台轮询、调用本机 Agent、投递回复`;
async function main(){
 if(!command||command==='help'){console.log(usage);return;}
 mkdirSync(dir,{recursive:true,mode:0o700});chmodSync(dir,0o700);
 if(command==='check'){
  if(!process.env.CLIENT_AGENT_FILE)throw Error('请设置 CLIENT_AGENT_FILE');
  const agent=normalizeAgent(JSON.parse(readFileSync(process.env.CLIENT_AGENT_FILE,'utf8')));
  console.log(JSON.stringify({public:registrationPayload(args[0]||'我的电脑',agent),localOnly:['ownerName','persona','shareableProfile','engine','model'],note:'配置有效；尚未验证 CLI 登录或模型连通性'},null,2));return;
 }
 if(command==='init'){
  const initLock=join(dir,'registration.lock');let initFd;
  try{initFd=openSync(initLock,'wx',0o600);}catch{throw Error('此目录正在注册；如上次中断，请确认注册进程退出后检查配置，再移除 registration.lock');}
  try{
  if(existsSync(configPath))throw Error('此 Client 已注册，请使用新的 CLIENT_DATA_DIR 创建其他设备');
  const relay=validateRelayURL(args[0]);const name=args[1];
  if(!process.env.CLIENT_INVITE_TOKEN)throw Error('请设置 CLIENT_INVITE_TOKEN');
  if(!process.env.CLIENT_AGENT_FILE)throw Error('请设置 CLIENT_AGENT_FILE，参见 client/agent.example.json');
  const agent=normalizeAgent(JSON.parse(readFileSync(process.env.CLIENT_AGENT_FILE,'utf8')));
  const payload=registrationPayload(name,agent);
  const c=new MessengerClient({config:{relay},dbPath:join(dir,'client.sqlite'),dataDir:dir});
  try{const device=await c.api('/v1/devices',payload,process.env.CLIENT_INVITE_TOKEN);writeFileSync(configPath,JSON.stringify({relay,...device,agent},null,2),{mode:0o600,flag:'wx'});console.log(`设备已注册：${device.id}。令牌保存在本机配置中。`);}finally{c.close();}
  }finally{closeSync(initFd);unlinkSync(initLock);}return;
 }
 const config=JSON.parse(readFileSync(configPath,'utf8'));
 // Serialize local commands and daemon so a second process cannot repeat inference.
 const lock=join(dir,'client.lock');let fd;
 try{if(['run','retry'].includes(command))fd=openSync(lock,'wx',0o600);}catch{throw Error('Client 数据目录正被使用；如上次异常退出，请确认原进程已退出后删除 client.lock');}
 const controller=new AbortController();
 const stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
 const c=new MessengerClient({config,dbPath:join(dir,'client.sqlite'),dataDir:dir,recoverProcessing:['run','retry'].includes(command)});
 try{
  if(command==='directory')console.log(JSON.stringify(await c.api('/v1/directory'),null,2));
  else if(command==='requests')console.log(JSON.stringify(await c.api('/v1/requests'),null,2));
  else if(command==='request')console.log(JSON.stringify(await c.api('/v1/requests',{to:args[0]}),null,2));
  else if(['accept','decline'].includes(command))console.log(JSON.stringify(await c.api('/v1/requests/decision',{id:args[0],accept:command==='accept'}),null,2));
  else if(command==='send'){const key=c.queue(args[0],args.slice(1).join(' '));console.log(`消息已保存：${key}`);await c.flush();console.log('已投递至 Relay');}
  else if(command==='inbox')console.log(JSON.stringify(c.db.prepare('SELECT id,json,status,error,result FROM inbox ORDER BY rowid DESC LIMIT 100').all().map(r=>({...r,message:JSON.parse(r.json),json:undefined})),null,2));
  else if(command==='retry')await c.retry(args[0],controller.signal);
  else if(command==='run'){
   console.log(`知交信使 Client 在线：${config.name} (${config.id})`);
   while(!controller.signal.aborted){try{await c.tick(controller.signal);}catch(e){console.error(`连接/投递失败：${e.message}`);}try{await delay(2000,undefined,{signal:controller.signal});}catch{}}
  }else throw Error(usage);
 }finally{c.close();if(fd!==undefined){closeSync(fd);unlinkSync(lock);}process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
