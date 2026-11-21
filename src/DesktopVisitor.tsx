import React,{useState} from 'react';
import {GripHorizontal,Link as LinkIcon} from 'lucide-react';
import {AnimatedCompanion} from './AnimatedCompanion';
import './desktop-visitor.css';
export type DesktopVisitorInfo={id:string;hostId:string;from:string;name:string;skin:string;note:string;url:string;expiresAt:number};
export function DesktopVisitor({visitor,onEnd}:{visitor:DesktopVisitorInfo;onEnd:(reply:string)=>Promise<boolean>}){
 const [wave,setWave]=useState(0);const [replying,setReplying]=useState(false);const [reply,setReply]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function end(){if(busy)return;setBusy(true);try{await onEnd(reply);}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function openLink(e:React.MouseEvent){const desktop=(window as any).desktop;if(desktop?.openVisitLink){e.preventDefault();try{await desktop.openVisitLink(visitor.url)}catch(err){setError((err as Error).message)}}}
 return <main className="desktop-visitor" aria-label={`${visitor.name}来串门`}>
 <div className="visitor-drag" title="拖动访客"><GripHorizontal size={16}/></div>
 <section className="visitor-speech" aria-label="来访口信"><header><strong>{visitor.name}</strong><span>来做客</span></header><p className="visitor-note" role="status">{visitor.note}</p>
 {visitor.url&&<a href={visitor.url} target="_blank" rel="noopener noreferrer" onClick={openLink}><LinkIcon size={12}/>带来的链接</a>}
 {replying&&<textarea aria-label="给访客捎回的话" value={reply} maxLength={1000} onChange={e=>setReply(e.target.value)} placeholder="给对方捎句话…"/>}
 <footer><button disabled={busy} onClick={()=>setReplying(!replying)}>{replying?'收起回复':'捎句话'}</button><button disabled={busy} onClick={end}>{busy?'正在送客…':replying?'送客并带回回复':'送客'}</button></footer>{error&&<p className="visitor-error" role="alert">{error}</p>}</section>
 <button className="visitor-figure" aria-label={`让${visitor.name}再招招手`} onClick={()=>setWave(w=>w+1)}><AnimatedCompanion key={visitor.id} skin={visitor.skin} action="wave" motionKey={wave}/></button>
 <div className="visitor-nameplate">{visitor.name}<small>访客</small></div>
 </main>;
}
