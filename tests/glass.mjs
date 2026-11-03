import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const page=await browser.newPage({viewport:{width:620,height:540},reducedMotion:'reduce'});
 const state={agents:[{id:'preview',name:'桃桃',ownerName:'马修',skin:'peach',enabled:true}],primaryAgentId:'preview',messages:[{id:'m',agentId:'preview',role:'assistant',text:'马修，我在。需要了解的事情交给我，有新消息就告诉你。',createdAt:Date.now()}],links:[],busy:[]};
 await page.route('**/api/events',r=>r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify(state)+'\n\n'}));
 await page.goto('http://127.0.0.1:4317');await page.getByLabel('点击桃桃').waitFor();
 async function assertClear(){for(const selector of ['html','body','#root','.desktop-space'])assert.equal(await page.locator(selector).evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)',selector)}
 await assertClear();await page.screenshot({path:'/tmp/taotao-glass-collapsed.png',omitBackground:true});
 await page.getByLabel('点击桃桃').click();await page.getByRole('button',{name:'和我说说…'}).click();await page.getByLabel('对桃桃说').fill('今天有什么新消息？');await assertClear();
 assert.match(await page.locator('.recent-bubble.assistant p').evaluate(e=>getComputedStyle(e).backdropFilter),/blur/);
 const panel=await page.locator('.whisper-panel').boundingBox();const character=await page.locator('.desktop-character').boundingBox();assert.ok(panel.x>=character.x+character.width,'chat opens to the right');assert.equal(await page.locator('.whisper-panel').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(17, 19, 24)');
 await page.screenshot({path:'/tmp/taotao-glass-transparent.png',omitBackground:true});
 // A test-only wallpaper makes the translucent edges readable in the QA image.
 await page.evaluate(()=>{const wall=document.createElement('div');wall.style.cssText='position:fixed;inset:0;z-index:-1;background:radial-gradient(ellipse at 10% 15%,#d9d5ff,transparent 65%),radial-gradient(ellipse at 90% 60%,#9abec5,transparent 65%),linear-gradient(120deg,#d6b9a4,#d1dbe4)';document.body.prepend(wall)});
 await page.screenshot({path:'/tmp/taotao-glass-preview.png'});await page.getByLabel('收起气泡').click();await page.locator('.whisper-panel').waitFor({state:'hidden'});await assertClear();
 console.log('PASS: transparent canvas collapsed/expanded, glass blur active, input and collapse usable');
}finally{await browser.close()}
