import test from 'node:test';import assert from 'node:assert/strict';import {parseDecision} from '../server/social.mjs';
const contacts=[{id:'b',name:'小白'}];
test('valid owner delegation resolves to an authorized destination',()=>{assert.deepEqual(parseDecision('{"reply":"好的","sendMessage":{"to":"b","text":"你好"}}',contacts).sendMessage,{to:'b',text:'你好'})});
test('invalid/unknown destinations never become dispatches',()=>{for(const value of ['not json','{"reply":"ok","sendMessage":{"to":"stranger","text":"hi"}}','{"reply":"ok","sendMessage":{"to":"b","text":""}}'])assert.throws(()=>parseDecision(value,contacts))});
test('capability question can reply without dispatch',()=>{assert.equal(parseDecision('{"reply":"能联系小白","sendMessage":null}',contacts).sendMessage,null)});
