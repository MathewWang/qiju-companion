import {test} from 'node:test';import assert from 'node:assert/strict';import {existsSync,readFileSync} from 'node:fs';
test('cloud server needs neither desktop UI nor model CLI runtime',()=>{
 for(const path of ['src','runtime','client','electron.cjs','public'])assert.equal(existsSync(new URL('../'+path,import.meta.url)),false);
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));assert.equal(Object.keys(pkg.dependencies||{}).length,0);
});
