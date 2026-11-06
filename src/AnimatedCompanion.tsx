import React,{useEffect,useRef,useState} from 'react';
import './companion-motion.css';
import characters from '../shared/characters.json';
export type Motion='idle'|'wave'|'sit'|'stand';
type Phase='idle'|'wave'|'sitting-down'|'seated'|'standing-up';

export function AnimatedCompanion({skin='taotao',sleep=false,busy=false,attention='',action,motionKey=0,onPhase}:{skin?:string;sleep?:boolean;busy?:boolean;attention?:string;action?:Motion;motionKey?:number;onPhase?:(phase:string)=>void}){
 const preset=characters.find(c=>c.id===skin)||characters[0];const SHEET=preset.motion.sheet;const name=preset.name;
 const [phase,setPhase]=useState<Phase>('idle');const [frame,setFrame]=useState(0);const [failed,setFailed]=useState(false);
 const phaseRef=useRef<Phase>('idle');const tick=useRef(0);const target=useRef<Motion>('idle');const timer=useRef(0);const desired=useRef<Motion>('idle');
 const change=(next:Phase)=>{phaseRef.current=next;tick.current=0;setFrame(next==='seated'||next==='standing-up'?11:next==='sitting-down'?8:next==='wave'?4:0);setPhase(next)};
 useEffect(()=>{setFailed(false);const img=new Image();img.src=SHEET;img.onerror=()=>setFailed(true);return()=>{img.onerror=null}},[SHEET]);
 useEffect(()=>{desired.current=action||(sleep?'sit':busy?'stand':'idle');const request=desired.current;target.current=request;
  if(phaseRef.current==='seated'||phaseRef.current==='sitting-down'){if(request!=='sit')change('standing-up')}
  else if(request==='sit')change('sitting-down');else if(request==='wave')change('wave');else change('idle');
 },[action,motionKey,sleep,busy]);
 const lastAttention=useRef(attention);
 useEffect(()=>{if(attention===lastAttention.current)return;lastAttention.current=attention;if(!attention||sleep||action||phaseRef.current==='wave')return;target.current='wave';timer.current=0;if(['seated','sitting-down'].includes(phaseRef.current))change('standing-up');else change('wave')},[attention,sleep,action]);
 useEffect(()=>{onPhase?.(phase)},[phase,onPhase]);
 useEffect(()=>{
  const activity=()=>{timer.current=0;if(!action&&!sleep&&phaseRef.current==='seated'){target.current='idle';change('standing-up')}};
  window.addEventListener('pointerdown',activity);window.addEventListener('keydown',activity);
  const interval=setInterval(()=>{if(document.hidden)return;
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   const p=phaseRef.current;tick.current++;timer.current+=125;
   if(reduced){if(p==='sitting-down')change('seated');else if(['standing-up','wave'].includes(p))change('idle');setFrame(p==='seated'||p==='sitting-down'?11:0);return}
   if(p==='sitting-down'){setFrame(8+Math.min(3,Math.floor(tick.current/3)));if(tick.current>=12)change('seated')}
   else if(p==='standing-up'){setFrame(8+Math.max(0,3-Math.floor(tick.current/3)));if(tick.current>=12)change(target.current==='wave'?'wave':'idle')}
   else if(p==='wave'){setFrame(4+(Math.floor(tick.current/2)%4));if(tick.current>=24){target.current=action==='sit'?'sit':'idle';change('idle')}}
   else if(p==='seated')setFrame(11);
   else {const cycle=tick.current%48;setFrame(cycle<4?cycle:0);if(!action&&!sleep&&!busy&&timer.current>=180000)change('sitting-down')}
  },125);
  return()=>{clearInterval(interval);window.removeEventListener('pointerdown',activity);window.removeEventListener('keydown',activity)};
 },[action,sleep,busy]);
 const row=Math.floor(frame/4),col=frame%4;
 return <div className={`anime-motion ${phase} ${busy?'motion-busy':''}`} data-motion={phase} role="img" aria-label={`${name} · ${{idle:'待机',wave:'招手','sitting-down':'坐下',seated:'休息','standing-up':'站起'}[phase]}`}>
 {failed?<img className="motion-fallback" src={preset.image} alt={name}/>:<div className="motion-frame"><img src={SHEET} alt="" aria-hidden="true" draggable={false} style={{left:`${-col*100}%`,top:`${-row*100}%`}}/></div>}{busy&&<span className="motion-thought">···</span>}</div>;
}
