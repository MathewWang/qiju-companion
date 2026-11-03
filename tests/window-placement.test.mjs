import test from 'node:test';import assert from 'node:assert/strict';import placement from '../window-placement.cjs';
const work={x:0,y:0,width:1440,height:900};
test('opening from resting right corner moves character left while retaining right/bottom edge',()=>{const home={x:1180,y:565,width:240,height:320};const open=placement.expandedBounds(home,work);assert.deepEqual(open,{x:800,y:345,width:620,height:540});assert.equal(open.x+open.width,home.x+home.width);assert.deepEqual(placement.clampBounds(home,work),home)});
test('placement remains on negative-origin and small monitors',()=>{const w={x:-800,y:100,width:500,height:450};const result=placement.expandedBounds({x:-550,y:300,width:240,height:320},w);assert.deepEqual(result,{x:-800,y:100,width:500,height:450})});
