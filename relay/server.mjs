import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdirSync,realpathSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {normalizePublicProfile} from '../shared/agent-profile.mjs';
import {RelayStore,hash} from './store.mjs';
const validString=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
export function createRelay({dbPath,inviteToken}) {
 if(!inviteToken||inviteToken.length<32)throw Error('RELAY_INVITE_TOKEN 至少需要 32 个字符');
 const store=new RelayStore(dbPath);
 const buckets=new Map();
 const server=http.createServer(async(req,res)=>{
  const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  const path=new URL(req.url,'http://localhost').pathname;
  if(req.method==='GET'&&path==='/healthz')return send(200,{ok:true,service:'知交信使'});
  // No browser access or cookie authentication: every private endpoint requires a bearer token.
  if(req.headers.origin)return send(403,{error:'请使用已认证的 Client'});
  let body={};
  try {
   if(req.method==='POST') {
    if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'需要 JSON'});
    const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>32768){send(413,{error:'请求过大'});return;}chunks.push(chunk);}
    body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');if(!body||Array.isArray(body)||typeof body!=='object')throw Error('无效请求');
   }
   const token=req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1]||'';
   const secretOK=timingSafeEqual(Buffer.from(hash(token)),Buffer.from(hash(inviteToken)));
   const actor=path==='/v1/devices'&&req.method==='POST'?null:store.authenticate(token);
   if(!actor&&! (path==='/v1/devices'&&req.method==='POST'&&secretOK))return send(401,{error:'认证失败'});
   const key=actor?.id||req.socket.remoteAddress;
   const now=Date.now();let bucket=buckets.get(key);if(!bucket||now-bucket.at>60000){bucket={at:now,count:0};buckets.set(key,bucket);}
   if(++bucket.count>180)return send(429,{error:'请求过于频繁'});
   if(buckets.size>10000)for(const [k,v] of buckets)if(now-v.at>60000)buckets.delete(k);
   if(req.method==='POST'&&path==='/v1/devices') {
    if(!validString(body.name,60))throw Error('设备名称需为 1–60 字符');
    let profile;
    if(body.profile!==undefined){
     if(body.publishProfile!==true)throw Error('公开名片需要明确授权');
     profile=normalizePublicProfile(body.profile);
    }
    const token=randomBytes(32).toString('base64url');
    const device=store.register(body.name.trim(),token,profile);
    return send(201,{...device,token});
   }
   if(req.method==='GET'&&path==='/v1/directory')return send(200,store.directory());
   if(req.method==='GET'&&path==='/v1/requests')return send(200,store.requests(actor.id));
   if(req.method==='POST'&&path==='/v1/requests')return send(200,store.request(actor.id,body.to));
   if(req.method==='POST'&&path==='/v1/requests/decision') {
    if(typeof body.accept!=='boolean')throw Error('需要明确同意或拒绝');return send(200,store.decide(actor.id,body.id,body.accept));
   }
   if(req.method==='POST'&&path==='/v1/messages') {
    if(!validString(body.to,80)||!validString(body.key,100)||!validString(body.text,16000)||!['question','reply'].includes(body.kind))throw Error('无效消息');
    return send(200,store.send(actor.id,body));
   }
   if(req.method==='POST'&&path==='/v1/inbox/pull')return send(200,{message:store.pull(actor.id)});
   if(req.method==='POST'&&path==='/v1/inbox/ack')return send(200,store.ack(actor.id,body.id));
   send(404,{error:'接口不存在'});
  }catch(e){send(400,{error:e instanceof SyntaxError?'无效 JSON':e.message});}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 return {server,store};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(realpathSync(resolve(process.argv[1]))).href){
 const dir=resolve(process.env.RELAY_DATA_DIR||'.data/relay');mkdirSync(dir,{recursive:true,mode:0o700});
 const {server,store}=createRelay({dbPath:join(dir,'relay.sqlite'),inviteToken:process.env.RELAY_INVITE_TOKEN});
 const port=Number(process.env.PORT||4318);server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`知交信使 Relay listening on ${port}`));
 const cleanup=setInterval(()=>store.db.prepare('DELETE FROM messages WHERE acknowledged_at < ?').run(Date.now()-7*86400000),3600000);cleanup.unref();
 for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{clearInterval(cleanup);server.close(()=>{store.close();process.exit(0);});});
}
