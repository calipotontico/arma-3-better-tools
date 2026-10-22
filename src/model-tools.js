import {readLights,writeLights} from './lighting-data.js';
export function modelStats(objects){
  const seen=new Set();let triangles=0,vertices=0;
  for(const object of objects.filter(Boolean))object.traverse(o=>{
    if(!o.isMesh||seen.has(o))return;
    seen.add(o);const g=o.geometry,p=g?.getAttribute('position');
    vertices+=p?.count||0;triangles+=Math.floor((g?.index?.count??p?.count??0)/3);
  });
  return {objects:seen.size,triangles,vertices};
}
export function deleteModelObjects(root,selection,doors){
  const targets=selection.filter(o=>o!==root&&root.getObjectByProperty('uuid',o.uuid)===o);
  const removed=new Set();targets.forEach(o=>o.traverse(n=>removed.add(n.uuid)));
  for(const [id,d] of Object.entries(doors)){
    if(removed.has(id))delete doors[id];
    else if(removed.has(d.switchId))delete d.switchId;
  }
  writeLights(root,readLights(root).filter(l=>!removed.has(l.lampId)&&!removed.has(l.switchId)));
  for(const group of root.userData.abtSceneGroups||[])group.members=group.members.filter(id=>!removed.has(id));
  targets.forEach(o=>o.removeFromParent());
  root.traverse(o=>{if(o.userData.calipoDoor&&!o.children.length){delete doors[o.uuid];o.removeFromParent();}});
}
