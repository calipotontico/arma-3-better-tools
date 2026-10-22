import {slideDelta} from './door-motion.js';
import { BufferGeometry, Matrix4, Vector3 } from 'three';
// Replace geometry rather than mutate it: other objects and undo snapshots may share it.
export function invertFaces(objects){
  const meshes=new Set();for(const object of objects)object.traverse(o=>{if(o.isMesh)meshes.add(o);});
  for(const mesh of meshes){
    const g=new BufferGeometry().copy(mesh.geometry),position=g.getAttribute('position');delete g.parameters;if(!position){g.dispose();continue;}
    if(!g.index)g.setIndex(Array.from({length:position.count},(_,i)=>i));
    const index=g.index;for(let i=0;i+2<index.count;i+=3){const a=index.getX(i);index.setX(i,index.getX(i+2));index.setX(i+2,a);}index.needsUpdate=true;
    const normals=[g.getAttribute('normal'),...(g.morphAttributes.normal||[])].filter(Boolean);
    for(const normal of normals){for(let i=0;i<normal.count;i++)normal.setXYZ(i,-normal.getX(i),-normal.getY(i),-normal.getZ(i));normal.needsUpdate=true;}
    if(!g.getAttribute('normal'))g.computeVertexNormals();
    const tangent=g.getAttribute('tangent');if(tangent){for(let i=0;i<tangent.count;i++)tangent.setW(i,-tangent.getW(i));tangent.needsUpdate=true;}
    mesh.geometry=g;
  }
}
export function topObjects(objects){const set=new Set(objects);return objects.filter(o=>{for(let p=o.parent;p;p=p.parent)if(set.has(p))return false;return true;});}
export function transformObjects(records, delta) {
  for(const {object,world} of records){
    object.parent.updateWorldMatrix(true,false);
    object.matrix.copy(object.parent.matrixWorld).invert().multiply(delta).multiply(world);
    object.matrixAutoUpdate=false;object.updateMatrixWorld(true);
  }
}
export function transformAxis(config,delta){
  const pivot=new Vector3().fromArray(config.pivot);
  const end=pivot.clone().addScaledVector(new Vector3().fromArray(config.direction||[0,1,0]),config.height);
  pivot.applyMatrix4(delta);end.applyMatrix4(delta).sub(pivot);
  return {...config,...(config.slide?{slide:slideDelta(config.slide,delta)}:{}),...(config.trigger?{trigger:new Vector3(...config.trigger).applyMatrix4(delta).toArray()}:{}),pivot:pivot.toArray(),direction:end.clone().normalize().toArray(),height:Math.max(end.length(),.00001)};
}
export function deltaMatrix(position,rotation,scale,center){
  return new Matrix4().makeTranslation(...position).multiply(new Matrix4().makeTranslation(...center))
    .multiply(new Matrix4().makeRotationX(rotation[0])).multiply(new Matrix4().makeRotationY(rotation[1])).multiply(new Matrix4().makeRotationZ(rotation[2]))
    .multiply(new Matrix4().makeScale(...scale)).multiply(new Matrix4().makeTranslation(...center.map(v=>-v)));
}

export function editMaterials(objects,change){
    const visited=new Set();for(const object of objects)object.traverse(o=>{
      if(!o.isMesh||visited.has(o))return;visited.add(o);
      const edit=m=>{const copy=m.clone();delete copy.userData.armaLibrary;change(copy,o);copy.needsUpdate=true;return copy;};
      o.material=Array.isArray(o.material)?o.material.map(edit):edit(o.material);
    });
  }
