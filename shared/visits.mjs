import {randomUUID} from 'node:crypto';
export const VISIT_PENDING_MS=24*60*60*1000;
export const VISIT_ACTIVE_MS=5*60*1000;
const live=v=>['pending','active'].includes(v.status);
const text=(value,max,required=false)=>{if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Error(`文字需为 ${required?1:0}–${max} 字符`);return value.trim()};
export function expireVisits(visits,now=Date.now()){
 let changed=false;for(const v of visits)if(live(v)&&v.expiresAt<=now){v.status='expired';v.endedAt=now;changed=true}return changed;
}
export function createVisit(visits,{from,to,note,url='',key},areFriends,now=Date.now()){
 expireVisits(visits,now);
 if(!from||!to||from===to||!areFriends(from,to))throw Error('只能拜访已建立关系的好友');
 note=text(note,1000,true);key=text(key,100,true);url=text(url,2000);
 if(url){const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw Error('链接必须是无登录凭证的 HTTPS 地址');url=u.href}
 const prior=visits.find(v=>v.from===from&&v.key===key);
 if(prior){if(prior.to!==to||prior.note!==note||prior.url!==url)throw Error('拜访编号已用于其他内容');return prior}
 if(visits.some(v=>v.from===from&&v.to===to&&live(v)))throw Error('这个好友已有待处理或进行中的拜访');
 const v={id:randomUUID(),key,from,to,note,url,status:'pending',createdAt:now,expiresAt:now+VISIT_PENDING_MS};visits.push(v);return v;
}
export function actOnVisit(visits,{id,actor,action,reply=''},now=Date.now()){
 expireVisits(visits,now);const v=visits.find(v=>v.id===id);
 if(!v||![v.from,v.to].includes(actor))throw Error('拜访不存在');
 if(!['accept','decline','cancel','end'].includes(action))throw Error('无效的拜访操作');
 if(['accept','decline','end'].includes(action)&&v.to!==actor)throw Error('只有接待方可以执行此操作');
 if(action==='cancel'&&v.from!==actor)throw Error('只有来访方可以取消');
 reply=text(reply,1000);if(reply&&action!=='end')throw Error('仅送客时可以捎回回复');
 const target={accept:'active',decline:'declined',cancel:'cancelled',end:'ended'}[action];
 if(v.status===target){if(action==='end'&&(v.reply||'')!==reply)throw Error('这次拜访已结束，不能更改回复');return v}
 if(action==='accept'){
  if(v.status!=='pending')throw Error('这次拜访已无法接受');
  if(visits.some(other=>other.id!==id&&other.to===actor&&other.status==='active'))throw Error('已有访客，请先送客');
  v.acceptedAt=now;v.expiresAt=now+VISIT_ACTIVE_MS;
 }else if(action==='decline'){if(v.status!=='pending')throw Error('只能拒绝待处理的拜访')}
 else if(action==='end'){if(v.status!=='active')throw Error('访客已离开或尚未进门');v.reply=reply}
 else if(!live(v))throw Error('这次拜访已结束');
 v.status=target;if(!live(v))v.endedAt=now;return v;
}
