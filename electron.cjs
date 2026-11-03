const {app,BrowserWindow,ipcMain,screen,Tray,Menu,nativeImage}=require('electron');
const {spawn}=require('node:child_process');
const path=require('node:path');
const {expandedBounds}=require('./window-placement.cjs');
let isExpanded=false;
let service,history,pet,tray,quitting=false;
const url='http://127.0.0.1:4317';
async function ready(){for(let i=0;i<80;i++){try{const r=await fetch(url+'/api/state');if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,250))}throw Error('本地服务启动超时')}
function openHistory(){if(!history){history=new BrowserWindow({width:520,height:700,minWidth:360,minHeight:480,show:false,title:'和桃桃的对话',transparent:true,backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false}});history.loadURL(url+'/?history=1');history.webContents.setWindowOpenHandler(()=>({action:'deny'}));history.on('close',e=>{if(!quitting){e.preventDefault();history.hide()}})}history.show();history.focus()}
// Keep a stable transparent canvas. Only compositor transforms animate the UI.
function resizePet(expanded){isExpanded=expanded;}

app.whenReady().then(async()=>{
 try{await fetch(url+'/api/state')}catch{service=spawn(process.execPath,[path.join(__dirname,'server/index.mjs')],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1',PATH:'/opt/homebrew/bin:/usr/local/bin:'+process.env.PATH},stdio:'ignore'})}
 await ready();const work=screen.getPrimaryDisplay().workArea;
 const canvas=expandedBounds({x:Math.max(work.x,work.x+work.width-260),y:work.y+work.height-335,width:240,height:320},work);
 pet=new BrowserWindow({...canvas,transparent:true,backgroundColor:'#00000000',frame:false,hasShadow:false,resizable:false,alwaysOnTop:true,skipTaskbar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false}});pet.loadURL(url);pet.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 ipcMain.on('open-history',openHistory);ipcMain.on('hide-history',()=>history?.hide());ipcMain.on('set-expanded',(_e,value)=>resizePet(value===true));
 ipcMain.on('pointer-through',(_e,value)=>pet?.setIgnoreMouseEvents(value===true,{forward:true}));
 tray=new Tray(nativeImage.createEmpty());tray.setTitle('✳');tray.setToolTip('桃桃 · 栖居');tray.setContextMenu(Menu.buildFromTemplate([{label:'和桃桃的历史聊天',click:openHistory},{label:'显示桃桃',click:()=>pet.show()},{type:'separator'},{label:'退出栖居',click:()=>app.quit()}]));
 app.on('activate',()=>pet.show());
}).catch(e=>{console.error(e);app.quit()});
app.on('before-quit',()=>{quitting=true;service?.kill()});
