const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktop',{openHistory:()=>ipcRenderer.send('open-history'),hideHistory:()=>ipcRenderer.send('hide-history'),setExpanded:expanded=>ipcRenderer.send('set-expanded',expanded)});
// Transparent parts of the floating window must not block the user's desktop.
if(!location.search.includes('history'))window.addEventListener('DOMContentLoaded',()=>{let last;window.addEventListener('mousemove',e=>{const interactive=e.target.closest?.('.whisper-panel,.desktop-character');const through=!interactive;if(through!==last){last=through;ipcRenderer.send('pointer-through',through)}});});
