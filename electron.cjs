const {app,BrowserWindow,ipcMain,screen,Tray,Menu,nativeImage}=require('electron');
const {spawn}=require('node:child_process');
const path=require('node:path');
let service,history,pet,tray,quitting=false;
const url='http://127.0.0.1:4317';
async function ready(){for(let i=0;i<80;i++){try{const r=await fetch(url+'/api/state');if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,250))}throw Error('本地服务启动超时')}
function openHistory(){if(!history){history=new BrowserWindow({width:520,height:700,minWidth:360,minHeight:480,show:false,title:'和桃桃的对话',backgroundColor:'#fffcf7',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false}});history.loadURL(url+'/?history=1');history.webContents.setWindowOpenHandler(()=>({action:'deny'}));history.on('close',e=>{if(!quitting){e.preventDefault();history.hide()}})}history.show();history.focus()}
function resizePet(expanded){if(!pet)return;const b=pet.getBounds();const work=screen.getDisplayMatching(b).workArea;const w=expanded?390:190,h=expanded?650:210;const x=Math.max(work.x,Math.min(b.x+b.width-w,work.x+work.width-w));const y=Math.max(work.y,Math.min(b.y+b.height-h,work.y+work.height-h));pet.setBounds({x,y,width:w,height:h});}
app.whenReady().then(async()=>{
 try{await fetch(url+'/api/state')}catch{service=spawn(process.execPath,[path.join(__dirname,'server/index.mjs')],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1',PATH:'/opt/homebrew/bin:/usr/local/bin:'+process.env.PATH},stdio:'ignore'})}
 await ready();const work=screen.getPrimaryDisplay().workArea;
 pet=new BrowserWindow({width:190,height:210,x:work.x+work.width-210,y:work.y+work.height-225,transparent:true,frame:false,hasShadow:false,resizable:false,alwaysOnTop:true,skipTaskbar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false}});pet.loadURL(url);pet.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 ipcMain.on('open-history',openHistory);ipcMain.on('hide-history',()=>history?.hide());ipcMain.on('set-expanded',(_e,value)=>resizePet(value===true));
 ipcMain.on('pointer-through',(_e,value)=>pet?.setIgnoreMouseEvents(value===true,{forward:true}));
 tray=new Tray(nativeImage.createEmpty());tray.setTitle('✳');tray.setToolTip('桃桃 · 栖居');tray.setContextMenu(Menu.buildFromTemplate([{label:'和桃桃的历史聊天',click:openHistory},{label:'显示桃桃',click:()=>pet.show()},{type:'separator'},{label:'退出栖居',click:()=>app.quit()}]));
 app.on('activate',()=>pet.show());
}).catch(e=>{console.error(e);app.quit()});
app.on('before-quit',()=>{quitting=true;service?.kill()});
