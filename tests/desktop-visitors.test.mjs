import {test} from 'node:test';import assert from 'node:assert/strict';
import {desktopVisitors} from '../shared/desktop-visitors.mjs';
import placement from '../window-placement.cjs';
const now=10000;const host={id:'local-host',name:'主人助理',skin:'taotao',persona:'private'};
const visit={id:'visit-1',from:'remote-friend',to:'host-device',status:'active',note:'带句话来看看你。',url:'https://example.com',expiresAt:now+1000};
const state={agents:[host],cloud:{registered:true,agentId:host.id,deviceId:'host-device',directory:[{id:'remote-friend',profile:{name:'来访的小白',skin:'xiaobai',publicBio:'公开'}}],visits:[visit]}};
test('desktop guest uses visitor public identity and appearance, never host appearance or private data',()=>{
 const guests=desktopVisitors(state,now);assert.deepEqual(guests,[{id:visit.id,hostId:host.id,from:visit.from,name:'来访的小白',skin:'xiaobai',note:visit.note,url:visit.url,expiresAt:visit.expiresAt}]);assert.equal(JSON.stringify(guests).includes('private'),false);
});
test('pending, outgoing, declined, recalled, ended and expired visits never create a desktop guest',()=>{
 for(const status of ['pending','declined','cancelled','ended','expired'])assert.deepEqual(desktopVisitors({...state,cloud:{...state.cloud,visits:[{...visit,status}]}},now),[]);
 assert.deepEqual(desktopVisitors({...state,cloud:{...state.cloud,visits:[{...visit,to:'other-device'}]}},now),[]);
 assert.deepEqual(desktopVisitors(state,visit.expiresAt),[]);
});
test('local visits use visitor catalog skin and unknown skins fall back to a shipped animated character',()=>{
 const local={agents:[host,{id:'friend',name:'本机好友',skin:'qinghe'}],visits:[{...visit,from:'friend',to:host.id}]};assert.equal(desktopVisitors(local,now)[0].skin,'qinghe');
 const unknown={...state,cloud:{...state.cloud,directory:[{id:visit.from,profile:{name:'未知形象',skin:'https://untrusted.test/arbitrary.js'}}]}};
 assert.equal(desktopVisitors(unknown,now)[0].skin,'taotao');
});
test('guest window is placed toward display interior without resizing host canvas',()=>{
 const work={x:0,y:0,width:1440,height:900};const hostRight={x:800,y:345,width:620,height:540};const guest=placement.visitorBounds(hostRight,'left',work);assert.ok(guest.x+guest.width<placement.characterCenter(hostRight,'left').x);assert.ok(guest.x>=0&&guest.y>=0&&guest.y+guest.height<=900);
 const hostLeft={x:0,y:345,width:620,height:540};const rightGuest=placement.visitorBounds(hostLeft,'right',work);assert.ok(rightGuest.x>placement.characterCenter(hostLeft,'right').x);
 const small={x:-800,y:100,width:300,height:400};const confined=placement.visitorBounds(hostLeft,'right',small);assert.deepEqual(confined,{x:-800,y:100,width:300,height:400});
});
