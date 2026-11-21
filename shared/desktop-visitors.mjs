import characters from './characters.json' with {type:'json'};
// Project only accepted incoming visits and public appearance data into desktop windows.
export function desktopVisitors(state,now=Date.now()){
 return (state.agents||[]).flatMap(host=>{
  const cloud=state.cloud?.registered&&state.cloud.agentId===host.id?state.cloud:null;
  const self=cloud?cloud.deviceId:host.id;
  return (cloud?.visits||state.visits||[]).filter(v=>v.to===self&&v.status==='active'&&v.expiresAt>now).map(v=>{
   const local=(state.agents||[]).find(a=>a.id===v.from);
   const remote=cloud?.directory?.find(d=>d.id===v.from);
   const profile=cloud?remote?.profile:local;
   const skin=characters.find(c=>c.id===profile?.skin)?.id||characters[0].id;
   return {id:v.id,hostId:host.id,from:v.from,name:profile?.name||remote?.name||'好友助理',skin,note:v.note,url:v.url||'',expiresAt:v.expiresAt};
  });
 });
}
