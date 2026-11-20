function clampBounds(bounds,work){
 const width=Math.min(bounds.width,work.width),height=Math.min(bounds.height,work.height);
 return {x:Math.max(work.x,Math.min(bounds.x,work.x+work.width-width)),y:Math.max(work.y,Math.min(bounds.y,work.y+work.height-height)),width,height};
}
function expandedBounds(home,work){
 const width=Math.min(620,work.width),height=Math.min(540,work.height);
 return clampBounds({x:home.x+home.width-width,y:home.y+home.height-height,width,height},work);
}
module.exports={clampBounds,expandedBounds};

// Match the fixed desktop canvas: 12px inset, 360px panel, 12px gap, 210px character.
function characterCenter(bounds,side='left'){
 const offset=bounds.width>=600?(side==='left'?384:12):12;
 return {x:bounds.x+offset+105,y:bounds.y+bounds.height-110};
}
function conversationPlacement(bounds,currentSide,work){
 const center=characterCenter(bounds,currentSide);
 const side=center.x<work.x+work.width/2?'right':'left';
 if(bounds.width<600)return {side,bounds:clampBounds(bounds,work)};
 const offset=side==='left'?384:12;
 return {side,bounds:clampBounds({...bounds,x:center.x-offset-105},work)};
}
module.exports.characterCenter=characterCenter;
module.exports.conversationPlacement=conversationPlacement;
