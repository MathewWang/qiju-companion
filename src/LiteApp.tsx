import {desktopVisitors} from '../shared/desktop-visitors.mjs';
import {DesktopVisitor} from './DesktopVisitor';
import {CompanionAvatar} from './CompanionAvatar';
import {CloudPanel,type CloudState} from './CloudPanel';
import {CloudConfirmations} from './CloudConfirmations';
import React,{useEffect,useLayoutEffect,useState,useRef} from 'react';
import {Send,Clock,X,ChevronDown,Settings,Square,Pause,Play,GripHorizontal,Check} from 'lucide-react';
import {Creature} from './Creature';
import './lite.css';
import {Visits,type Visit} from './Visits';
import {Registration} from './Registration';
import './companion-theme.css';
type Agent={id:string;name:string;ownerName:string;ownerId:string;shareableProfile:string;skin:string;enabled:boolean;engine?:string;publicBio?:string;lastError?:string};
type Message={id:string;agentId:string;role:string;text:string;channel?:string;createdAt:number;cloudStatus?:string;cloudMessageId?:string};
type State={cloud?:CloudState;visits?:Visit[];registrationComplete?:boolean;engines?:{id:string;installed:boolean;label:string}[];friendRequests?:{id:string;from:string;to:string;status:string}[];agents:Agent[];primaryAgentId?:string;messages:Message[];links:string[][];busy:string[]};
const desktop=(window as any).desktop;
async function post(path:string,body:unknown){const r=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error);return d}
export function LiteApp(){
 const [panelSide,setPanelSide]=useState(new URLSearchParams(location.search).get('panel')||'right');
 useEffect(()=>{if(!desktop)return;void desktop.getPanelSide?.().then(setPanelSide);return desktop.onPanelSide?.(setPanelSide)},[]);
 const visitorMode=new URLSearchParams(location.search).get('visit');
 const [clock,setClock]=useState(Date.now());
 useEffect(()=>{if(!visitorMode)return;const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer)},[visitorMode]);
 useEffect(()=>desktop?.onVisitorArrived?.(()=>setExpanded(false)),[]);
 const pinnedId=new URLSearchParams(location.search).get('agent');const historyMode=new URLSearchParams(location.search).has('history');
 const [state,setState]=useState<State>({agents:[],messages:[],links:[],busy:[]});const [connected,setConnected]=useState(false);const [expanded,setExpanded]=useState(false);const [tab,setTab]=useState<'chat'|'friends'|'visits'|'settings'>('chat');
 const [visitTarget,setVisitTarget]=useState('');const [visitHistory,setVisitHistory]=useState(false);
 const [text,setText]=useState('');const [error,setError]=useState('');const [sending,setSending]=useState(false);const [seen,setSeen]=useState(localStorage.getItem('companion-seen-'+(pinnedId||'primary'))||'');const [ownerName,setOwnerName]=useState('');const [profile,setProfile]=useState('');const [saved,setSaved]=useState(false);
 const input=useRef<HTMLTextAreaElement>(null);const bottom=useRef<HTMLDivElement>(null);const messageViewport=useRef<HTMLDivElement>(null);
 useEffect(()=>{const s=new EventSource('/api/events');s.onmessage=e=>{setState(JSON.parse(e.data));setConnected(true)};s.onerror=()=>setConnected(false);return()=>s.close()},[]);
 const agent=state.agents.find(a=>a.id===(pinnedId||state.primaryAgentId))||state.agents[0];const cloud=state.cloud?.agentId===agent?.id?state.cloud:undefined;
 const messages=state.messages.filter(m=>m.agentId===agent?.id&&!m.channel&&['user','assistant','error'].includes(m.role));const latest=messages.filter(m=>m.role!=='user').at(-1);const busy=!!agent&&state.busy.includes(agent.id);const unread=!!latest&&latest.id!==seen;
 const contacts=agent?state.agents.filter(a=>a.id!==agent.id&&state.links.some(l=>l.includes(agent.id)&&l.includes(a.id))):[];
 const ownerPending=cloud?.messages.filter(m=>['waiting_owner','drafting'].includes(m.status)).length||0;
 const friendPending=cloud?.requests.filter(r=>r.recipient===cloud.deviceId&&r.status==='pending').length||0;
 const myVisits=cloud?.registered?cloud.visits:(state.visits||[]);const self=cloud?.registered?cloud.deviceId:agent?.id;
 const visitor=myVisits.find(v=>v.to===self&&v.status==='active');const knocking=myVisits.filter(v=>v.to===self&&v.status==='pending').length;
 const visitorName=cloud?.directory.find(d=>d.id===visitor?.from)?.profile?.name||state.agents.find(a=>a.id===visitor?.from)?.name||'好友';
 const visitorSkin=cloud?.directory.find(d=>d.id===visitor?.from)?.profile?.skin||state.agents.find(a=>a.id===visitor?.from)?.skin||'taotao';
 const status=!connected?'连接中':!agent?.enabled?'休息中':busy?'处理中':cloud?.registered?(cloud.connected?'云端在线':'云端离线'):'本机在线';
 useEffect(()=>{if(agent){setOwnerName(agent.ownerName);setProfile(agent.shareableProfile)}},[agent?.id,agent?.ownerName,agent?.shareableProfile]);
 useEffect(()=>{if(!historyMode)desktop?.setExpanded?.(expanded)},[expanded,historyMode]);
 useEffect(()=>{if((expanded&&tab==='chat')||historyMode){if(latest){setSeen(latest.id);localStorage.setItem('companion-seen-'+(agent?.id||'primary'),latest.id)}}},[latest?.id,expanded,historyMode,tab]);
 useLayoutEffect(()=>{if(!historyMode&&(!expanded||tab!=='chat'))return;const frame=requestAnimationFrame(()=>{const pane=messageViewport.current;if(pane)pane.scrollTop=pane.scrollHeight});return()=>cancelAnimationFrame(frame)},[tab,expanded,historyMode]);
 useEffect(()=>{if(!historyMode&&tab!=='chat')return;const pane=messageViewport.current;pane?.scrollTo({top:pane.scrollHeight,behavior:'smooth'})},[messages.length,historyMode,ownerPending]);
 useEffect(()=>{const fn=(e:KeyboardEvent)=>{if(e.key==='Escape')setExpanded(false)};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[]);
 async function act(path:string,data:unknown){setError('');setSending(true);try{await post(path,data);return true}catch(e){setError((e as Error).message);return false}finally{setSending(false)}}
 async function send(e:React.FormEvent){e.preventDefault();if(!agent||!text.trim()||busy||sending)return;if(await act('chat',{id:agent.id,text}))setText('')}
 function openTab(next:typeof tab){setTab(next);setExpanded(true);setError('')}
 function openHistory(){if(desktop)desktop.openHistory(agent?.id);else location.href='/?history=1&agent='+encodeURIComponent(agent?.id||'')}
 const composer=<form className="lite-composer" onSubmit={send}><textarea ref={input} aria-label={`对${agent?.name||'助理'}说`} placeholder={`和${agent?.name||'助理'}说点什么…`} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send(e)}}}/>{busy?<button aria-label="停止" type="button" onClick={()=>act('cancel',{id:agent?.id})}><Square size={16}/></button>:<button className="lite-send" aria-label="发送" disabled={!text.trim()||sending||!agent?.enabled||!connected}><Send size={18}/></button>}</form>;
 const confirmation=<CloudConfirmations cloud={cloud} act={act} disabled={sending||!connected||!agent?.enabled}/>;
 if(visitorMode){const visitor=desktopVisitors(state,clock).find(v=>v.id===visitorMode&&v.hostId===pinnedId);return visitor?<DesktopVisitor key={visitor.id} visitor={visitor} onEnd={async reply=>{const ok=await act(cloud?.registered?'cloud/visit-action':'visits/action',{id:visitor.id,actor:agent?.id,action:'end',reply});if(!ok)throw Error('送客暂未成功，请稍后再试');return true}}/>:<div className="visitor-waiting"/>;}
 if(connected&&state.registrationComplete===false)return <Registration engines={state.engines}/>;
 if(historyMode)return <div className="history-page"><header className="lite-heading"><div className="history-title"><Creature skin={agent?.skin||'taotao'} small/><div><strong>和{agent?.name}的对话</strong><small>{status}</small></div></div><button aria-label="收起历史" onClick={()=>desktop?desktop.hideHistory():location.assign('/?agent='+encodeURIComponent(agent?.id||''))}><X size={18}/></button></header><div className="history-messages" ref={messageViewport}>{messages.map(m=><article className={`history-message ${m.role}`} key={m.id}><small>{m.role==='user'?'我':agent?.name} · {new Date(m.createdAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</small><p>{m.text}</p></article>)}{confirmation}{busy&&<p className="lite-busy">正在处理…</p>}<div ref={bottom}/></div>{error&&<p role="alert" className="lite-error">{error}</p>}{composer}</div>;
 const displayMessages=messages;
 return <div className={`desktop-space ${desktop?'native':'web'} panel-${panelSide}`}><div className={`companion-anchor ${expanded?'expanded':''}`}>
 <section className="whisper-panel" aria-hidden={!expanded} inert={!expanded}><header className="lite-heading"><div><strong>{tab==='settings'?'设置':agent?.name||'知交信使'}</strong><small className="header-presence"><i className={!connected||!agent?.enabled||cloud?.registered&&!cloud.connected?'off':''}/>{status==='云端在线'?'在线':status}</small></div><div><button aria-label="设置" onClick={()=>setTab(tab==='settings'?'chat':'settings')}><Settings size={15}/></button><button aria-label="收起气泡" onClick={()=>setExpanded(false)}><ChevronDown size={18}/></button></div></header>
 {tab!=='settings'&&<nav className="companion-tabs" aria-label="助理功能">{(['chat','friends','visits'] as const).map(t=><button key={t} aria-current={tab===t?'page':undefined} onClick={()=>openTab(t)}>{({chat:'聊天',friends:'好友',visits:'串门'})[t]}{(t==='chat'?ownerPending:t==='friends'?friendPending:knocking)>0&&<i/>}</button>)}{tab==='visits'&&<button className="visit-history-toggle" aria-pressed={visitHistory} onClick={()=>setVisitHistory(!visitHistory)}><Clock size={14}/>往来记录</button>}</nav>}
 {error&&<p role="alert" className="lite-error">{error}</p>}
 {tab==='chat'?<><div className="recent-bubbles" ref={messageViewport}>{displayMessages.map(m=><div className={`recent-bubble ${m.role}`} key={m.id}>{m.role!=='user'&&<CompanionAvatar skin={agent?.skin} name={agent?.name||'助理'}/>}<p>{m.text}</p></div>)}{confirmation}{!messages.length&&!ownerPending&&<p className="panel-empty">我在，想聊些什么？</p>}{busy&&<p className="lite-busy">正在处理…</p>}<div ref={bottom}/></div>{composer}<div className="whisper-footer"><button onClick={openHistory}><Clock size={12}/>全部对话</button></div></>:
 tab==='friends'?<div className="panel-content">{agent&&<CloudPanel cloud={state.cloud} agent={agent} act={act} disabled={sending||!connected} onVisit={id=>{setVisitTarget(id);setVisitHistory(false);openTab('visits')}}/>}</div>:
 tab==='visits'?(agent&&(cloud?.registered?<CloudPanel cloud={cloud} agent={agent} act={act} disabled={sending||!connected} visitsOnly visitTarget={visitTarget} onChooseFriends={()=>openTab('friends')} historyOpen={visitHistory} onCloseHistory={()=>setVisitHistory(false)}/>:<Visits agent={agent} agents={state.agents} contacts={contacts} visits={state.visits||[]} act={act} disabled={sending||!connected} initialTo={visitTarget} onChooseFriends={()=>openTab('friends')} historyOpen={visitHistory} onCloseHistory={()=>setVisitHistory(false)}/>)):
 <div className="lite-settings">{agent&&<CloudPanel cloud={state.cloud} agent={agent} act={act} disabled={sending||!connected} mode="settings"/>}<label>怎么称呼你<input aria-label="我的称呼" value={ownerName} onChange={e=>{setOwnerName(e.target.value);setSaved(false)}}/></label><label>允许分享的近况<textarea aria-label="公开近况" value={profile} onChange={e=>{setProfile(e.target.value);setSaved(false)}} placeholder="只填写你愿意让好友知道的内容"/></label><button className="lite-save" disabled={sending} onClick={async()=>{if(await act('profile',{id:agent?.id,ownerName,shareableProfile:profile}))setSaved(true)}}>{saved?<><Check size={13}/>已保存</>:'保存资料'}</button><p className="lite-hint">好友提问先由你确认。拟稿只使用授权资料。</p><button className="quiet-control" onClick={()=>act('toggle',{id:agent?.id})}>{agent?.enabled?<Pause size={13}/>:<Play size={13}/>} {agent?.enabled?'让助理休息':'让助理上线'}</button><button className="settings-back" onClick={()=>setTab('chat')}>返回聊天</button></div>}
 </section>
 <div className="desktop-character">{visitor&&!desktop&&<button className="visitor-badge" onClick={()=>openTab('visits')}><Creature skin={visitorSkin} small/><span>{visitorName}来做客</span></button>}<div className="drag-handle" title="拖动"><GripHorizontal size={18}/></div><button className="character-button" aria-label={`点击${agent?.name||'助理'}`} onClick={()=>setExpanded(!expanded)}><Creature skin={agent?.skin||'taotao'} busy={busy} sleep={!agent?.enabled} attention={latest?.id||myVisits.find(v=>v.to===self&&v.status==='pending')?.id||''}/>{unread&&!expanded&&<span className="unread-pearl" aria-label="有新消息"/>}</button><div className="character-info"><strong>{agent?.name||'助理'}</strong><small><i className={!connected||!agent?.enabled||cloud?.registered&&!cloud.connected?'offline':busy?'busy':''}/>{status}</small>{ownerPending>0?<button onClick={()=>openTab('chat')}>{ownerPending} 条消息待确认</button>:knocking>0?<button onClick={()=>openTab('visits')}>有朋友敲门</button>:friendPending>0?<button onClick={()=>openTab('friends')}>新的好友申请</button>:null}</div></div>
 </div></div>;
}
