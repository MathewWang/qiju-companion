const {app,BrowserWindow,ipcMain,screen,Tray,Menu,nativeImage,shell}=require('electron');
const {spawn}=require('node:child_process');
const path=require('node:path');
const {expandedBounds,characterCenter,conversationPlacement,visitorBounds}=require('./window-placement.cjs');
let service,tray,setup,visitorTimer,pickVisitors,visitorsBusy=false,quitting=false;
const visitors=new Map();
const pets=new Map(),histories=new Map(),placements=new Map();
const url='http://127.0.0.1:4317';
const preferences={preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false};
async function ready(){for(let i=0;i<80;i++){try{const r=await fetch(url+'/api/state');if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,250))}throw Error('本地服务启动超时')}
function openHistory(id){
 if(setup){setup.show();return}
 if(!pets.has(id))id=pets.keys().next().value;
 if(!id)return;
 let history=histories.get(id);
 if(!history){
  history=new BrowserWindow({width:520,height:700,minWidth:360,minHeight:480,show:false,title:'知交信使 · 历史聊天',transparent:true,backgroundColor:'#00000000',webPreferences:preferences});
  histories.set(id,history);history.loadURL(url+'/?history=1&agent='+encodeURIComponent(id));
  history.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  history.on('close',e=>{if(!quitting){e.preventDefault();history.hide()}});
 }
 history.show();history.focus();
}
function createPets(agents){
 const work=screen.getPrimaryDisplay().workArea;
 agents.forEach((a,index)=>{
  if(pets.has(a.id))return;
  // Each companion owns its canvas and conversation; transparent regions pass through.
  const gap=Math.min(640,Math.max(250,(work.width-260)/Math.max(1,agents.length-1)));
  const canvas=expandedBounds({x:work.x+work.width-260-index*gap,y:work.y+work.height-335,width:240,height:320},work);
  const pet=new BrowserWindow({...canvas,title:a.name+' · 知交信使',transparent:true,backgroundColor:'#00000000',frame:false,hasShadow:false,resizable:false,alwaysOnTop:true,skipTaskbar:true,webPreferences:preferences});
  pets.set(a.id,pet);placements.set(pet,'left');pet.loadURL(url+'/?agent='+encodeURIComponent(a.id)+'&panel=left');
  let placementTimer;
  pet.on('move',()=>{clearTimeout(placementTimer);placementTimer=setTimeout(()=>{
   if(pet.isDestroyed())return;
   const previous=placements.get(pet)||'left';const bounds=pet.getBounds();
   const work=screen.getDisplayNearestPoint(characterCenter(bounds,previous)).workArea;
   const next=conversationPlacement(bounds,previous,work);
   placements.set(pet,next.side);
   if(next.side!==previous){pet.setBounds(next.bounds);pet.webContents.send('panel-placement',next.side);}
  },160);});
  pet.on('closed',()=>{clearTimeout(placementTimer);placements.delete(pet)});
  pet.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  pet.on('closed',()=>pets.delete(a.id));
 });
}
async function syncVisitors(){
 if(visitorsBusy||quitting||!pickVisitors)return;visitorsBusy=true;
 try{
  for(const [id,entry] of visitors)if(entry.expiresAt<=Date.now()){entry.win.destroy();visitors.delete(id)}
  const response=await fetch(url+'/api/state',{signal:AbortSignal.timeout(5000)});if(!response.ok)return;
  const state=await response.json();if(quitting)return;
  const wanted=pickVisitors(state);const ids=new Set(wanted.map(v=>v.id));
  for(const [id,entry] of visitors)if(!ids.has(id)){entry.win.destroy();visitors.delete(id)}
  for(const visitor of wanted){
   if(visitors.has(visitor.id))continue;const host=pets.get(visitor.hostId);if(!host||host.isDestroyed())continue;
   const side=placements.get(host)||'left';const bounds=host.getBounds();const work=screen.getDisplayNearestPoint(characterCenter(bounds,side)).workArea;
   const win=new BrowserWindow({...visitorBounds(bounds,side,work),title:visitor.name+' · 来做客',transparent:true,backgroundColor:'#00000000',frame:false,hasShadow:false,resizable:false,alwaysOnTop:true,skipTaskbar:true,show:false,webPreferences:preferences});
   visitors.set(visitor.id,{win,expiresAt:visitor.expiresAt});
   win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
   win.loadURL(url+'/?agent='+encodeURIComponent(visitor.hostId)+'&visit='+encodeURIComponent(visitor.id));
   win.once('ready-to-show',()=>{if(!win.isDestroyed())win.showInactive()});
   win.on('close',e=>{if(!quitting){e.preventDefault();win.hide()}});
   win.on('closed',()=>visitors.delete(visitor.id));
   host.webContents.send('visitor-arrived',visitor.id);
  }
 }catch(e){console.error('同步桌面访客失败：'+e.message)}finally{visitorsBusy=false;}
}
function showAll(){if(setup)setup.show();else{for(const pet of pets.values())pet.show();for(const {win} of visitors.values())win.showInactive()}}
if(!app.requestSingleInstanceLock()){app.quit();}else{
app.on('second-instance',showAll);
app.whenReady().then(async()=>{
 try{await fetch(url+'/api/state')}catch{service=spawn(process.execPath,[path.join(__dirname,'server/index.mjs')],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1',PATH:'/opt/homebrew/bin:/usr/local/bin:'+process.env.PATH},stdio:'ignore'})}
 await ready();
 ({desktopVisitors:pickVisitors}=await import('./shared/desktop-visitors.mjs'));
 const state=await (await fetch(url+'/api/state')).json();
 if(state.registrationComplete===false){
  setup=new BrowserWindow({width:1000,height:820,minWidth:760,minHeight:650,title:'知交信使 · 注册助理',backgroundColor:'#151719',webPreferences:preferences});
  setup.loadURL(url+'/?register=1');setup.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  setup.on('closed',()=>{setup=null;if(!pets.size)app.quit()});
 }else createPets(state.agents);
 ipcMain.handle('open-visit-link',async(_event,value)=>{if(typeof value!=='string'||value.length>2000)throw Error('Invalid link');const target=new URL(value);if(target.protocol!=='https:'||target.username||target.password)throw Error('Only HTTPS links are supported');await shell.openExternal(target.href)});
 ipcMain.handle('finish-registration',async()=>{const current=await (await fetch(url+'/api/state')).json();if(!current.registrationComplete)throw Error('请先完成注册');createPets(current.agents);setup?.close()});
 ipcMain.handle('panel-placement',e=>placements.get(BrowserWindow.fromWebContents(e.sender))||'left');
 ipcMain.on('open-history',(_e,id)=>openHistory(id));
 ipcMain.on('hide-history',e=>BrowserWindow.fromWebContents(e.sender)?.hide());
 ipcMain.on('pointer-through',(e,value)=>{const win=BrowserWindow.fromWebContents(e.sender);if([...pets.values(),...Array.from(visitors.values(),v=>v.win)].includes(win))win.setIgnoreMouseEvents(value===true,{forward:true})});
 visitorTimer=setInterval(()=>void syncVisitors(),1000);void syncVisitors();
 tray=new Tray(nativeImage.createEmpty());tray.setTitle('✳');tray.setToolTip('知交信使 · 我的助理');
 tray.setContextMenu(Menu.buildFromTemplate([{label:'显示所有助理',click:showAll},{label:'查看历史聊天',click:()=>openHistory()},{type:'separator'},{label:'退出知交信使',click:()=>app.quit()}]));
 app.on('activate',showAll);
}).catch(e=>{console.error(e);app.quit()});
app.on('before-quit',()=>{quitting=true;clearInterval(visitorTimer);service?.kill()});

}
