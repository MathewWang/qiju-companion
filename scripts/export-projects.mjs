import {cpSync,existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);const values=Object.fromEntries(args.flatMap((a,i)=>a.startsWith('--')?[[a,args[i+1]]]:[]));
const client=values['--client']&&resolve(values['--client']);const server=values['--server']&&resolve(values['--server']);
if(!client&&!server)throw Error('用法：node scripts/export-projects.mjs --client /empty/client --server /empty/server');
for(const dest of [client,server].filter(Boolean)){
 if(dest===root||root.startsWith(dest+'/')||dest.startsWith(root+'/.data/client'))throw Error('导出目录不能覆盖源码或运行数据');
 if(existsSync(dest)&&readdirSync(dest).length)throw Error(`导出目录非空，拒绝覆盖：${dest}`);
}
const copy=(dest,source,target=source)=>{const output=join(dest,target);mkdirSync(dirname(output),{recursive:true});cpSync(join(root,source),output,{recursive:true,errorOnExist:true,force:false});};
const write=(dest,name,value)=>{mkdirSync(dirname(join(dest,name)),{recursive:true});writeFileSync(join(dest,name),value);};
const json=value=>JSON.stringify(value,null,2)+'\n';
if(client){
 mkdirSync(client,{recursive:true});
 for(const file of ['client','runtime','shared','src','public','electron.cjs','preload.cjs','window-placement.cjs','index.html','tsconfig.json','AGENTS.md','.gitignore','启动知交信使.command','scripts/desktop.mjs','scripts/dev.mjs'])copy(client,file);
 copy(client,'licenses/client-MIT.txt','LICENSE');copy(client,'distribution/client/README.md','README.md');
 copy(client,'distribution/client/protocol.md','docs/protocol.md');copy(client,'distribution/client/migration.md','docs/migration.md');
 for(const file of ['INSTALL.md','docs/upgrade.md','docs/visits.md','docs/character-art.md','docs/character-motion-collection.md']){
  write(client,file,readFileSync(join(root,file),'utf8').replaceAll('MathewWang/qiju-companion','MathewWang/zhijiao-client'));
 }
 const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));pkg.name='zhijiao-client';pkg.license='MIT';pkg.description='开源桌面 Agent 客户端：本机模型、好友、串门与可定制 UI';pkg.engines={node:'>=24'};pkg.repository={type:'git',url:'https://github.com/MathewWang/zhijiao-client.git'};delete pkg.scripts.relay;delete pkg.scripts['export:projects'];
 write(client,'package.json',json(pkg));
 const lock=JSON.parse(readFileSync(join(root,'package-lock.json'),'utf8'));lock.name=pkg.name;Object.assign(lock.packages[''],{name:pkg.name,license:pkg.license,engines:pkg.engines});write(client,'package-lock.json',json(lock));
 for(const name of ['adapters','character-catalog','desktop-visitors','owner-confirmation','registration','social','window-placement','single-registration'])copy(client,`tests/${name}.test.mjs`);
 copy(client,'distribution/client/boundary.test.mjs','tests/boundary.test.mjs');
 write(client,'.github/workflows/ci.yml',`name: Client checks\non: [push, pull_request]\njobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '24'\n          cache: npm\n      - run: npm ci --include=dev\n        env:\n          ELECTRON_SKIP_BINARY_DOWNLOAD: '1'\n      - run: npm run build\n      - run: npm test\n`);
 console.log(`独立客户端已导出：${client}`);
}
if(server){
 mkdirSync(server,{recursive:true});for(const file of ['relay','deploy','.gitignore'])copy(server,file);
 for(const file of ['agent-profile.mjs','visits.mjs','characters.json'])copy(server,`shared/${file}`);
 copy(server,'distribution/server/README.md','README.md');copy(server,'distribution/server/boundary.test.mjs','tests/boundary.test.mjs');
 for(const name of ['visits','agent-profile'])copy(server,`tests/${name}.test.mjs`);
 const pkg={name:'zhijiao-server',version:'0.1.0',private:true,type:'module',engines:{node:'>=24'},scripts:{start:'node relay/server.mjs',test:'node --test tests/*.test.mjs'}};
 write(server,'package.json',json(pkg));write(server,'package-lock.json',json({name:pkg.name,version:pkg.version,lockfileVersion:3,requires:true,packages:{'':{name:pkg.name,version:pkg.version,engines:pkg.engines}}}));
 console.log(`独立服务端已导出：${server}`);
}
