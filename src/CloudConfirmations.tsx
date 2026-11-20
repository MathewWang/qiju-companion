import React,{useEffect,useState} from 'react';
import type {CloudState} from './CloudPanel';
type Props={cloud?:CloudState;act:(path:string,data:unknown)=>Promise<boolean>;disabled:boolean};
function Confirmation({item,cloud,act,disabled}:Props&{cloud:CloudState;item:CloudState['messages'][number]}){
 const [text,setText]=useState(item.result||'');
 useEffect(()=>setText(item.result||''),[item.id,item.result]);
 const peer=cloud.directory.find(p=>p.id===item.message.sender);const drafting=item.status==='drafting';
 return <article className="cloud-confirmation"><strong>{peer?.profile?.name||peer?.name||'好友'}在等你确认</strong><blockquote>{item.message.text}</blockquote><textarea aria-label="本次好友答复" value={text} maxLength={16000} disabled={disabled||drafting} onChange={e=>setText(e.target.value)} placeholder="告诉我这次可以怎么回复对方…"/>{item.error&&<p role="alert">{item.error}</p>}<div><button disabled={disabled||drafting||!text.trim()} onClick={()=>act('cloud/owner-reply',{id:item.id,text})}>确认并发送</button><button disabled={disabled||drafting} onClick={()=>act('cloud/draft',{id:item.id})}>{drafting?'正在拟稿…':'拟个回复'}</button><button disabled={disabled||drafting} onClick={()=>act('cloud/owner-decline',{id:item.id})}>暂不提供</button></div><small>拟稿使用模型额度，确认后才发送。</small></article>;
}
export function CloudConfirmations({cloud,act,disabled}:Props){
 const [index,setIndex]=useState(0);
 if(!cloud)return null;
 const pending=cloud.messages.filter(m=>['waiting_owner','drafting'].includes(m.status));
 if(!pending.length)return null;
 const item=pending[Math.min(index,pending.length-1)];
 return <div className="confirmation-queue">{pending.length>1&&<div className="compact-row"><small>{pending.length} 条待确认</small><button onClick={()=>setIndex((Math.min(index,pending.length-1)+1)%pending.length)}>下一条</button></div>}<Confirmation key={item.id} item={item} cloud={cloud} act={act} disabled={disabled}/></div>;
}
