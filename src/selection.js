export function doorOwner(object, root) {
  let owner = null;
  for (let p = object; p && p !== root; p = p.parent) {
    if (p.userData.calipoDoor) owner = p;
  }
  return owner;
}
export function selectionObject(object, root, individual = false) {
  let proxy=null;
  for(let p=object;p&&p!==root;p=p.parent)if(p.userData.armaProxy)proxy=p;
  return individual ? object : doorOwner(object, root) || proxy || object;
}
// Ray intersections are triangles, never the selection outline's bounding box.
export function visibleSurfaceHit(hits){
  return hits.find(hit=>{for(let p=hit.object;p;p=p.parent)if(!p.visible)return false;const material=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex??0]:hit.object.material;return material&&material.visible!==false&&!(material.transparent&&material.opacity===0);});
}
