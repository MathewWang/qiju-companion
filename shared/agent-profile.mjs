// Only this explicit projection may cross the Relay boundary.
export function normalizePublicProfile(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('请填写公开名片');
 for(const key of Object.keys(input))if(!['name','publicBio'].includes(key))throw Error(`公开名片不允许包含字段：${key}`);
 return {name:text(input,'name',40,true),publicBio:text(input,'publicBio',300)};
}
function text(input,key,max,required=false){
 const value=input[key]??'';
 if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Error(`请检查 ${key}（${required?'1':'0'}–${max} 字符）`);
 return value.trim();
}
export function normalizeAgent(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('角色配置必须是 JSON 对象');
 if(!['codex','opencode'].includes(input.engine))throw Error('请选择 codex 或 opencode 引擎');
 if(input.publishProfile!==true)throw Error('请先确认公开范围，将 publishProfile 设置为 true；仅公开助理名字和 publicBio，设备名也会进入目录');
 return {name:text(input,'name',40,true),ownerName:text(input,'ownerName',60,true),engine:input.engine,
  model:text(input,'model',150,input.engine==='opencode'),persona:text(input,'persona',2000)||'温暖可靠，重要事项向主人汇报。',
  publicBio:text(input,'publicBio',300),shareableProfile:text(input,'shareableProfile',2000),publishProfile:true};
}
export function registrationPayload(deviceName,agent){
 if(typeof deviceName!=='string'||!deviceName.trim()||deviceName.length>60)throw Error('设备名称需为 1–60 字符');
 const normalized=normalizeAgent(agent);
 return {name:deviceName.trim(),publishProfile:true,profile:normalizePublicProfile({name:normalized.name,publicBio:normalized.publicBio})};
}
