import {test} from 'node:test';import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';import {resolve,dirname,join,extname} from 'node:path';import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
test('client checkout is self-contained and contains no cloud server or deployment files',()=>{
 for(const name of ['relay','server','deploy'])assert.equal(existsSync(join(root,name)),false,`unexpected ${name}`);
 const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));assert.equal(pkg.license,'MIT');assert.equal(pkg.scripts.relay,undefined);assert.match(pkg.scripts.start,/runtime/);
 const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);
 for(const file of ['src','runtime','client','shared'].flatMap(dir=>walk(join(root,dir))).filter(f=>['.mjs','.ts','.tsx','.cjs'].includes(extname(f)))){
  const content=readFileSync(file,'utf8');for(const match of content.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){
   const value=match[1];if(!value.startsWith('.'))continue;const target=resolve(dirname(file),value);
   assert.ok(target.startsWith(root+'/'),`${file}: import escapes client root`);
   assert.ok(['','.tsx','.ts','.mjs','.cjs','.json','.css'].some(ext=>existsSync(target+ext)),`${file}: missing ${value}`);
  }
 }
});
