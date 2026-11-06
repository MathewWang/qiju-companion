import React,{useEffect,useRef,useState} from 'react';
import './companion-motion.css';
import characters from '../shared/characters.json';
export type Motion='idle'|'wave'|'sit'|'stand';
type Phase='idle'|'wave'|'sitting-down'|'seated'|'standing-up';

export function AnimatedCompanion({skin='taotao',sleep=false,busy=false,attention='',action,motionKey=0,onPhase}:{skin?:string;sleep?:boolean;busy?:boolean;attention?:string;action?:Motion;motionKey?:number;onPhase?:(phase:string)=>void}){
 const preset=characters.find(c=>c.id===skin)||characters[0];const SHEET=preset.motion.sheet;const name=preset.name;
 const [phase,setPhase]=useState<Phase>('idle');const [frame,setFrame]=useState(0);const [failed,setFailed]=useState(false);
 const phaseRef=useRef<Phase>('idle');const elapsed=useRef(0);const target=useRef<Motion>('idle');const timer=useRef(0);const desired=useRef<Motion>('idle');
 const change=(next:Phase)=>{phaseRef.current=next;elapsed.current=0;setFrame(next==='seated'||next==='standing-up'?11:next==='sitting-down'?8:next==='wave'?4:0);setPhase(next)};
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
  // The sheet has four authored poses per gesture. Ping-pong the wave so
  // the wrist returns through its intermediate poses instead of snapping back.
  const waveFrames = [4, 5, 6, 7, 6, 5];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let previous = performance.now();
  const interval = setInterval(() => {
   const now = performance.now();
   const delta = Math.min(now - previous, 80);
   previous = now;
   if (document.hidden) return;
   const phase = phaseRef.current;
   elapsed.current += delta;
   timer.current += delta;
   const time = elapsed.current;
   if (reducedMotion.matches) {
    if (phase === 'sitting-down') change('seated');
    else if (phase === 'standing-up' || phase === 'wave') change('idle');
    setFrame(phase === 'seated' || phase === 'sitting-down' ? 11 : 0);
    return;
   }
   if (phase === 'sitting-down' || phase === 'standing-up') {
    const pose = Math.min(3, Math.floor(time / 125));
    setFrame(phase === 'sitting-down' ? 8 + pose : 11 - pose);
    if (time >= 500) change(phase === 'sitting-down' ? 'seated' : target.current === 'wave' ? 'wave' : 'idle');
   } else if (phase === 'wave') {
    const step = Math.floor(time / 105);
    if (step >= waveFrames.length * 2) change('idle');
    else setFrame(waveFrames[step % waveFrames.length]);
   } else if (phase === 'idle') {
    const blink = Math.floor((time % 6000) / 85);
    setFrame(blink < 4 ? blink : 0);
    if (!action && !sleep && !busy && timer.current >= 180000) change('sitting-down');
   }
  }, 32);
  return()=>{clearInterval(interval);window.removeEventListener('pointerdown',activity);window.removeEventListener('keydown',activity)};
 },[action,sleep,busy]);
 const row=Math.floor(frame/4),col=frame%4;
 return <div className={`anime-motion ${phase} ${busy?'motion-busy':''}`} data-motion={phase} role="img" aria-label={`${name} · ${{idle:'待机',wave:'招手','sitting-down':'坐下',seated:'休息','standing-up':'站起'}[phase]}`}>
 {failed?<img className="motion-fallback" src={preset.image} alt={name}/>:<div className="motion-frame"><img src={SHEET} alt="" aria-hidden="true" draggable={false} style={{transform:`translate3d(${-col*25}%, ${-row*100/3}%, 0)`}}/></div>}{busy&&<span className="motion-thought">···</span>}</div>;
}
