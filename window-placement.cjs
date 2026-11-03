function clampBounds(bounds,work){
 const width=Math.min(bounds.width,work.width),height=Math.min(bounds.height,work.height);
 return {x:Math.max(work.x,Math.min(bounds.x,work.x+work.width-width)),y:Math.max(work.y,Math.min(bounds.y,work.y+work.height-height)),width,height};
}
function expandedBounds(home,work){
 const width=Math.min(620,work.width),height=Math.min(540,work.height);
 return clampBounds({x:home.x+home.width-width,y:home.y+home.height-height,width,height},work);
}
module.exports={clampBounds,expandedBounds};
