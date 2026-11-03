import test from 'node:test';import assert from 'node:assert/strict';
import {parseEvent,adapters} from '../server/adapters.mjs';
test('only final user-facing text is emitted, not reasoning/tool output',()=>{
 assert.equal(parseEvent('codex',{type:'item.completed',item:{type:'agent_message',text:'hello'}}),'hello');
 assert.equal(parseEvent('codex',{type:'item.completed',item:{type:'reasoning',text:'private'}}),'');
 assert.equal(parseEvent('opencode',{type:'text',part:{text:'hi'}}),'hi');
 assert.equal(parseEvent('opencode',{type:'tool_use',part:{text:'private'}}),'');
});
test('engine allowlist, no shell command interpolation, OpenCode tools denied',()=>{
 assert.equal(adapters.opencode.env.OPENCODE_PERMISSION,'{"*":"deny"}');
 assert.ok(adapters.codex.args().includes('read-only'));assert.equal(adapters.bash,undefined);
 assert.deepEqual(adapters.opencode.args('a; echo bad').slice(-2),['--model','a; echo bad']);
});
