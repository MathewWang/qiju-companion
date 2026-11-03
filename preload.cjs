const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktop',{finishRegistration:()=>ipcRenderer.invoke('finish-registration'),openHistory:id=>ipcRenderer.send('open-history',id),hideHistory:()=>ipcRenderer.send('hide-history'),setExpanded:expanded=>ipcRenderer.send('set-expanded',expanded)});
// Transparent parts of the floating window must not block the user's desktop.
if(!location.search.includes('history')&&!location.search.includes('register'))window.addEventListener('DOMContentLoaded',()=>{let last;window.addEventListener('mousemove',e=>{const interactive=e.target.closest?.('.whisper-panel,.desktop-character');const through=!interactive;if(through!==last){last=through;ipcRenderer.send('pointer-through',through)}});});
