import {DatabaseSync} from 'node:sqlite';
import {createHash, randomUUID} from 'node:crypto';
import {createVisit,actOnVisit,expireVisits} from '../shared/visits.mjs';
export const hash = value => createHash('sha256').update(value).digest('hex');
export class RelayStore {
 constructor(path) {
  this.db = new DatabaseSync(path);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
   CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY, sender TEXT NOT NULL REFERENCES devices(id), recipient TEXT NOT NULL REFERENCES devices(id), status TEXT NOT NULL DEFAULT 'pending');
   CREATE UNIQUE INDEX IF NOT EXISTS pending_pair ON requests(min(sender,recipient),max(sender,recipient)) WHERE status='pending';
   CREATE TABLE IF NOT EXISTS friendships(a TEXT NOT NULL REFERENCES devices(id), b TEXT NOT NULL REFERENCES devices(id), PRIMARY KEY(a,b));
   CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, sender TEXT NOT NULL REFERENCES devices(id), recipient TEXT NOT NULL REFERENCES devices(id), client_key TEXT NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL, reply_to TEXT, created_at INTEGER NOT NULL, lease_until INTEGER NOT NULL DEFAULT 0, acknowledged_at INTEGER, UNIQUE(sender,client_key));`);
  this.db.exec('CREATE TABLE IF NOT EXISTS visits(id TEXT PRIMARY KEY, sender TEXT NOT NULL, recipient TEXT NOT NULL, json TEXT NOT NULL)');
  if(!this.db.prepare('PRAGMA table_info(devices)').all().some(c=>c.name==='profile_json'))this.db.exec("ALTER TABLE devices ADD COLUMN profile_json TEXT");
 }
 register(name, token, profile=null) { const id=randomUUID(); this.db.prepare('INSERT INTO devices(id,token_hash,name,created_at,profile_json) VALUES(?,?,?,?,?)').run(id,hash(token),name,Date.now(),profile?JSON.stringify(profile):null); return {id,name}; }
 authenticate(token) { return this.db.prepare('SELECT id,name FROM devices WHERE token_hash=?').get(hash(token)); }
 directory() { return this.db.prepare('SELECT id,name,profile_json FROM devices ORDER BY created_at').all().map(({profile_json,...device})=>profile_json?{...device,profile:JSON.parse(profile_json)}:device); }
 friends(a,b) { return !!this.db.prepare('SELECT 1 FROM friendships WHERE a=? AND b=?').get(...[a,b].sort()); }
 request(from,to) {
  if(from===to || !this.db.prepare('SELECT 1 FROM devices WHERE id=?').get(to)) throw Error('无效的接收设备');
  if(this.friends(from,to)) return {alreadyFriends:true};
  const existing=this.db.prepare("SELECT * FROM requests WHERE status='pending' AND ((sender=? AND recipient=?) OR (sender=? AND recipient=?))").get(from,to,to,from);
  if(existing) return existing;
  const id=randomUUID(); this.db.prepare('INSERT INTO requests(id,sender,recipient) VALUES(?,?,?)').run(id,from,to);return {id,sender:from,recipient:to,status:'pending'};
 }
 requests(id) {return this.db.prepare('SELECT * FROM requests WHERE sender=? OR recipient=?').all(id,id);}
 decide(actor,id,accept) {
  const r=this.db.prepare('SELECT * FROM requests WHERE id=?').get(id);
  if(!r || r.recipient!==actor) throw Error('只有接收方可处理申请');
  if(r.status!=='pending') return r;
  this.db.exec('BEGIN IMMEDIATE');try {
   this.db.prepare('UPDATE requests SET status=? WHERE id=?').run(accept?'accepted':'declined',id);
   if(accept)this.db.prepare('INSERT OR IGNORE INTO friendships VALUES(?,?)').run(...[r.sender,r.recipient].sort());
   this.db.exec('COMMIT');
  } catch(e){this.db.exec('ROLLBACK');throw e;}
  return {...r,status:accept?'accepted':'declined'};
 }
 send(sender,b) {
  if(!this.friends(sender,b.to)) throw Error('请先建立好友关系');
  const prior=this.db.prepare('SELECT * FROM messages WHERE sender=? AND client_key=?').get(sender,b.key);
  if(prior) {
   if(prior.recipient!==b.to||prior.text!==b.text||prior.kind!==b.kind||(prior.reply_to||null)!==(b.replyTo||null))throw Error('消息幂等键已用于其他内容');
   return prior;
  }
  if(b.kind==='reply') {
   const original=this.db.prepare('SELECT * FROM messages WHERE id=?').get(b.replyTo);
   if(!original||original.recipient!==sender||original.sender!==b.to||original.kind!=='question')throw Error('无效的回复目标');
  } else if(b.replyTo) throw Error('仅回复消息可以包含回复目标');
  const id=randomUUID();this.db.prepare('INSERT INTO messages(id,sender,recipient,client_key,kind,text,reply_to,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id,sender,b.to,b.key,b.kind,b.text,b.replyTo||null,Date.now());
  return this.db.prepare('SELECT * FROM messages WHERE id=?').get(id);
 }
 pull(recipient) {
  const now=Date.now();this.db.exec('BEGIN IMMEDIATE');try {
   const m=this.db.prepare('SELECT * FROM messages WHERE recipient=? AND acknowledged_at IS NULL AND lease_until<=? ORDER BY created_at,rowid LIMIT 1').get(recipient,now);
   if(m)this.db.prepare('UPDATE messages SET lease_until=? WHERE id=?').run(now+240000,m.id);
   this.db.exec('COMMIT');return m||null;
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 ack(recipient,id) {
  const result=this.db.prepare('UPDATE messages SET acknowledged_at=COALESCE(acknowledged_at,?) WHERE id=? AND recipient=?').run(Date.now(),id,recipient);
  if(!result.changes)throw Error('消息不存在');return {ok:true};
 }
 visitTransaction(fn){
  this.db.exec('BEGIN IMMEDIATE');try{
   const visits=this.db.prepare('SELECT json FROM visits ORDER BY rowid').all().map(r=>JSON.parse(r.json));
   expireVisits(visits);const result=fn(visits);
   const save=this.db.prepare('INSERT OR REPLACE INTO visits(id,sender,recipient,json) VALUES(?,?,?,?)');
   for(const v of visits)save.run(v.id,v.from,v.to,JSON.stringify(v));
   this.db.exec('COMMIT');return result;
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 visits(actor){return this.visitTransaction(visits=>visits.filter(v=>v.from===actor||v.to===actor));}
 createVisit(actor,body){return this.visitTransaction(visits=>createVisit(visits,{...body,from:actor},(a,b)=>this.friends(a,b)));}
 actVisit(actor,body){return this.visitTransaction(visits=>actOnVisit(visits,{...body,actor}));}
 close(){this.db.close();}
}
