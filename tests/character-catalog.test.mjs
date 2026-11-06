import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {presets,makeAgent} from '../server/registration.mjs';
test('all selectable characters have assets and can be registered; unknown skins remain rejected',()=>{
 assert.equal(new Set(presets.map(p=>p.id)).size,8);
 assert.equal(presets.filter(p=>p.gender==='女士').length,6);
 assert.equal(presets.filter(p=>p.gender==='男士').length,2);
 const input={name:'Test',ownerName:'Owner',engine:'codex',publishProfile:true,autoAcceptFriends:false};
 for(const preset of presets){assert.ok(existsSync(new URL('../public'+preset.image,import.meta.url)),preset.image);assert.equal(makeAgent({...input,skin:preset.id}).skin,preset.id)}
 assert.throws(()=>makeAgent({...input,skin:'../../other'}));
});

test('every selectable character ships an RGBA 4-by-3 motion sheet',()=>{
 for(const preset of presets){
  assert.equal(preset.animated,true,preset.id);assert.equal(preset.motion.columns,4);assert.equal(preset.motion.rows,3);
  const file=new URL('../public'+preset.motion.sheet,import.meta.url);assert.ok(existsSync(file),preset.motion.sheet);
  const png=readFileSync(file);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png[25],6,'RGBA transparency channel required');
  assert.equal(png.readUInt32BE(16)/png.readUInt32BE(20),4/3,'square cells in four columns and three rows');
 }
});
