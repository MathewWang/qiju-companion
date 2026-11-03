import {_electron as electron} from '@playwright/test';import assert from 'node:assert/strict';
// Read-only desktop smoke check against the locally registered Demo. Sends no model requests.
const app=await electron.launch({args:['.']});
try{
 await new Promise(r=>setTimeout(r,3000));
 const pages=app.windows();assert.equal(pages.length,2,'requires two registered agents');
 const peach=pages.find(p=>p.url().includes('agent='));
 const ids=pages.map(p=>new URL(p.url()).searchParams.get('agent'));assert.equal(new Set(ids).size,2);
 const errors=[];for(const p of pages)p.on('pageerror',e=>errors.push(e.message));
 const names=[];
 for(const p of pages){const name=await p.locator('.character-info strong').innerText();names.push(name);await p.getByLabel('点击'+name).click();await p.getByRole('button',{name:'和我说说…',exact:true}).click();await p.getByLabel('对'+name+'说').fill('未发送的独立草稿 '+name);assert.ok(await p.locator('.character-info').innerText());}
 assert.deepEqual(new Set(names),new Set(['桃桃','小白']));
 for(const [i,p] of pages.entries())assert.equal(await p.getByLabel('对'+names[i]+'说').inputValue(),'未发送的独立草稿 '+names[i]);
 for(const p of pages)await p.getByRole('button',{name:'历史聊天',exact:true}).click();
 await new Promise(r=>setTimeout(r,500));
 const history=app.windows().filter(p=>p.url().includes('history=1'));assert.equal(history.length,2);
 for(const p of history){const id=new URL(p.url()).searchParams.get('agent');assert.ok(ids.includes(id));await p.locator('.history-page').waitFor();assert.ok((await p.locator('.history-title').innerText()).includes(names[ids.indexOf(id)]))}
 await pages[0].screenshot({path:'/tmp/dual-companion-one.png'});
 const bounds=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().includes('?agent=')).map(w=>w.getBounds()));assert.notEqual(bounds[0].x,bounds[1].x);
 assert.deepEqual(errors,[]);console.log('PASS: two distinct desktop canvases, owner/status cards, independent drafts, per-Agent history, no UI errors',bounds);
}finally{await app.close()}
