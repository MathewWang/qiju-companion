import {randomUUID} from 'node:crypto';
import characters from '../shared/characters.json' with {type:'json'};
export const presets=characters;
export function makeAgent(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('请填写助理资料');
 const str=(key,max,required=false)=>{const value=typeof input[key]==='string'?input[key].trim():'';if((required&&!value)||value.length>max)throw Error(`请检查${{name:'助理名字',ownerName:'主人称呼',model:'模型',publicBio:'公开简介',shareableProfile:'可分享近况',persona:'性格与职责'}[key]||key}`);return value};
 if(!['codex','opencode'].includes(input.engine))throw Error('请选择可用引擎');
 if(!presets.some(p=>p.id===input.skin))throw Error('请选择系统预制形象');
 if(typeof input.autoAcceptFriends!=='boolean')throw Error('请选择好友申请处理方式');
 if(input.publishProfile!==true)throw Error('请确认公开名片范围');
 return {id:randomUUID(),ownerId:randomUUID(),name:str('name',40,true),ownerName:str('ownerName',60,true),skin:input.skin,engine:input.engine,model:str('model',150,input.engine==='opencode'),persona:str('persona',2000)||'温暖可靠，重要事项及时向主人汇报。',publicBio:str('publicBio',300),shareableProfile:str('shareableProfile',2000),autoAcceptFriends:input.autoAcceptFriends,public:true,enabled:true,createdAt:Date.now()};
}
export function publicCard(agent){return {id:agent.id,name:agent.name,ownerId:agent.ownerId,ownerName:agent.ownerName,skin:agent.skin,publicBio:agent.publicBio||'',online:agent.enabled};}
export function requestFriend(state,from,to){
 if(from===to)throw Error('不能添加自己');
 if(!state.agents.some(a=>a.id===from)||!state.agents.some(a=>a.id===to&&a.public!==false))throw Error('未找到公开名片');
 if(state.links.some(l=>l.includes(from)&&l.includes(to)))return {alreadyFriends:true};
 const existing=state.friendRequests.find(r=>r.status==='pending'&&((r.from===from&&r.to===to)||(r.from===to&&r.to===from)));
 if(existing)return {request:existing,existing:true};
 const request={id:randomUUID(),from,to,status:'pending',createdAt:Date.now()};state.friendRequests.push(request);return {request};
}
export function decideFriend(state,requestId,actorId,accept){
 const request=state.friendRequests.find(r=>r.id===requestId);if(!request||request.to!==actorId)throw Error('只有收件方可以处理申请');
 if(request.status!=='pending')return null;
 request.status=accept?'accepted':'declined';request.decidedAt=Date.now();
 if(accept&&!state.links.some(l=>l.includes(request.from)&&l.includes(request.to)))state.links.push([request.from,request.to]);
 return request;
}
