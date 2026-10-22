import * as THREE from 'three';
import {doorOwner} from './selection.js';
import {readLights} from './lighting-data.js';
import {getLanguage} from './i18n.js';
const tr=(es,en)=>getLanguage()==='en'?en:es;

export function furnitureRoot(object,root){
  let candidate=object;
  for(let p=object;p&&p!==root;p=p.parent)if(p.userData.armaProxy||p.userData.polyhaven)candidate=p;
  return candidate;
}
export function validateFurniture(root,object,doors={}){
  if(!object||object===root)throw Error(tr('Selecciona un mueble.','Select a furniture item.'));
  const meshes=[],ids=new Set();
  object.traverse(o=>{ids.add(o.uuid);if(o.isMesh)meshes.push(o);});
  if(!meshes.length)throw Error(tr('El mueble no contiene piezas.','The furniture has no mesh parts.'));
  for(const mesh of meshes){
    const door=doors[mesh.uuid]||doors[doorOwner(mesh,root)?.uuid];
    if(mesh.isSkinnedMesh||mesh.isInstancedMesh||mesh.userData.armaGlass||mesh.userData.armaLadder||(door&&door.confirmed!==false))throw Error(tr('Los proxies requieren muebles fijos, sin puertas, cristales ni escaleras.','Proxies require static furniture without doors, glass or ladders.'));
  }
  if(readLights(root).some(l=>ids.has(l.lampId)||ids.has(l.switchId)))throw Error(tr('El mueble tiene una luz o interruptor vinculado.','The furniture has a linked light or switch.'));
  return object;
}
export function duplicateFurniture(root,object,doors={}){
  const source=validateFurniture(root,furnitureRoot(object,root),doors);
  source.updateWorldMatrix(true,true);
  source.userData.armaProxy=true;
  const copy=source.clone(true);copy.name=(source.name||tr('Mueble','Furniture'))+tr(' · copia',' · copy');
  // Geometry and materials remain shared; Three's project format stores them once.
  source.parent.add(copy);
  const size=new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3());
  const world=new THREE.Vector3().setFromMatrixPosition(source.matrixWorld);
  world.x+=Math.max(.5,size.x+.25);
  copy.position.copy(source.parent.worldToLocal(world));
  copy.matrix.setPosition(copy.position);copy.matrixAutoUpdate=false;copy.updateWorldMatrix(true,true);
  return copy;
}
