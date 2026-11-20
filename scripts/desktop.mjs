import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.argv[2]||'launch';
function run(command,args,capture=false){
 const result=spawnSync(command,args,{cwd:root,env:process.env,stdio:capture?'pipe':'inherit',encoding:'utf8'});
 if(result.error)throw Error(`无法执行 ${command}：${result.error.message}`);
 if(result.status!==0)throw Error(`${command} ${args.join(' ')} 未完成${capture?`：${result.stderr.trim()}`:''}`);
 return capture?result.stdout.trim():'';
}
try{
 if(!['check','setup','launch','update'].includes(mode))throw Error('用法：node scripts/desktop.mjs check|setup|launch|update');
 if(process.platform!=='darwin')throw Error('当前简易安装流程仅支持 macOS。');
 if(Number(process.versions.node.split('.')[0])<24)throw Error('请先安装 Node.js 24 或更新版本，再重新运行。');
 run('npm',['--version'],true);
 console.log(`知交信使 · Node ${process.versions.node} · ${root}`);
 if(mode==='check'){
  for(const command of ['codex','opencode']){
   const r=spawnSync(command,['--version'],{encoding:'utf8'});
   console.log(`${command}：${r.status===0?'已安装（请在注册页确认模型连接）':'未检测到，请先安装并登录至少一种本机引擎'}`);
  }
 }else{
  if(mode==='update'){
   if(run('git',['status','--porcelain'],true))throw Error('存在本地改动或未跟踪文件。请先保存并处理这些改动，再更新；不会自动覆盖或暂存。');
   const branch=run('git',['branch','--show-current'],true);
   if(branch!=='main')throw Error('自动更新只支持 main 分支，请先处理当前分支。');
   run('git',['pull','--ff-only','origin','main']);
  }
  const stamp=join(root,'.data','desktop-dependencies.sha256');
  const fingerprint=createHash('sha256').update(readFileSync(join(root,'package-lock.json'))).update(process.versions.node).update(process.arch).digest('hex');
  if(mode==='setup'||mode==='update'||!existsSync(join(root,'node_modules','electron','dist'))||!existsSync(stamp)||readFileSync(stamp,'utf8')!==fingerprint){
   run('npm',['ci','--include=dev']);
   // Some npm versions skip dependency lifecycle scripts by default.
   if(!existsSync(join(root,'node_modules','electron','path.txt')))run(process.execPath,[join(root,'node_modules','electron','install.js')]);
   mkdirSync(dirname(stamp),{recursive:true});writeFileSync(stamp,fingerprint);
  }
  run('npm',['run','build']);
  if(mode==='launch')run(process.execPath,[join(root,'node_modules','electron','cli.js'),'.']);
  else console.log('准备完成。运行 npm run desktop 或双击「启动知交信使.command」。');
 }
}catch(error){console.error(`\n${error.message}\n用户资料保存在 .data 中，请勿删除。`);process.exitCode=1;}
