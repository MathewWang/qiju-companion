import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const p=await b.newPage({viewport:{width:1400,height:950}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:4317/?studio=1');
if(await p.getByRole('button',{name:'创建第一个助理'}).count()){
 await p.getByRole('button',{name:'创建第一个助理'}).click();await p.getByLabel('助理名字').fill('小白');await p.getByRole('button',{name:'创建并入住'}).click();await p.getByRole('heading',{name:'小白',exact:true}).waitFor();
 await p.getByLabel('添加助理').click();await p.getByLabel('助理名字').fill('桃桃');await p.getByLabel('引擎',{exact:true}).selectOption('opencode');await p.getByLabel('形象 peach').click();await p.getByRole('button',{name:'创建并入住'}).click();
}
await p.getByRole('button',{name:/桃桃 OpenCode/}).waitFor();
await p.getByLabel('消息',{exact:true}).fill('你好！我是你的主人 Mathew。请用一句话介绍你自己，不使用工具。');await p.getByLabel('发送消息').click();await p.locator('.message.assistant').last().waitFor({timeout:180000});
await p.getByRole('button',{name:/桃桃 OpenCode/}).click();await p.getByLabel('消息',{exact:true}).fill('你好！请用一句话介绍你自己，不使用工具。');await p.getByLabel('发送消息').click();await p.locator('.message.assistant').last().waitFor({timeout:180000});
// Pause recipient, link and queue a friend message from Codex agent.
await p.getByLabel('暂停或上线').click();await p.getByRole('button',{name:/小白 Codex/}).click();await p.getByRole('button',{name:'好友消息',exact:true}).click();const options=await p.getByLabel('选择好友').locator('option').all();const id=await options[1].getAttribute('value');await p.getByLabel('选择好友').selectOption(id);
if(await p.getByRole('button',{name:'确认建立关系'}).count())await p.getByRole('button',{name:'确认建立关系'}).click();
await p.getByLabel('消息',{exact:true}).fill('你好桃桃，我是小白。我们以后一起帮主人整理信息，你擅长什么？');await p.getByLabel('发送消息').click();await p.getByRole('button',{name:/桃桃 OpenCode/}).click();await p.getByText('等待上线处理',{exact:true}).waitFor();await p.getByLabel('暂停或上线').click();await p.getByText('已处理',{exact:true}).first().waitFor({timeout:180000});
await p.getByRole('button',{name:'工作汇报',exact:true}).click();await p.getByRole('button',{name:'现在汇报'}).click();await p.locator('.reports article').waitFor({timeout:180000});
await p.getByRole('button',{name:'和我聊聊',exact:true}).click();await p.screenshot({path:'/tmp/companion-demo-desktop.png',fullPage:true});
await p.reload();await p.getByRole('button',{name:/小白 Codex/}).waitFor();await p.setViewportSize({width:390,height:844});await p.screenshot({path:'/tmp/companion-demo-mobile.png',fullPage:true});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
await b.close();console.log('PASS: role creation, both real engines, friendship, offline queue + resume, real report, persistence, mobile layout, no JS errors');
