import * as THREE from 'three';
import {activeBounds,upwardTriangle} from './surface-collision.js';

export const layerNames={geometry:'Colisión',fire:'Disparos',view:'Visión IA',roadway:'Suelos'};
export function modelMeshes(root){const out=[];root?.traverse(o=>{if(o.isMesh)out.push(o);});return out;}
export function defaultShape(mesh,plane=false){
  mesh.geometry.computeBoundingBox();const b=activeBounds(mesh);if(b.isEmpty())b.copy(mesh.geometry.boundingBox);
  const center=b.getCenter(new THREE.Vector3()),size=b.getSize(new THREE.Vector3());
  if(plane){center.y=b.max.y;size.y=0;}else size.max(new THREE.Vector3(.03,.03,.03));
  return {name:plane?'Suelo':'Caja',center:center.toArray(),size:size.toArray(),rotation:[0,0,0]};
}
export function shapesFor(mesh,layer){
  const saved=mesh.userData.armaLayers?.[layer];
  return saved??(layer==='shadow'?[]:layer==='roadway'?null:[defaultShape(mesh)]);
}
export function setShapes(mesh,layer,shapes){mesh.userData.armaLayers??={};if(mesh.userData.armaExistingInteriorLayers)delete mesh.userData.armaExistingInteriorLayers[layer];mesh.userData.armaLayers[layer]=structuredClone(shapes);mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox;mesh.userData.armaLayerBounds??={};mesh.userData.armaLayerBounds[layer]={min:b.min.toArray(),max:b.max.toArray()};mesh.userData.armaAutomaticLayers??={};mesh.userData.armaAutomaticLayers[layer]=false;}
export function validateShape(s,plane=false){
  if(s?.vertices&&(!Array.isArray(s.vertices)||s.vertices.length<4||s.vertices.some(v=>!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite))||!Array.isArray(s.indices)||s.indices.length<12||s.indices.length%3||s.indices.some(i=>!Number.isInteger(i)||i<0||i>=s.vertices.length)))throw Error('Componente de superficie inválido.');
  if(!s||![s.center,s.size,s.rotation].every(a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite))||s.size[0]<=0||s.size[2]<=0||(!plane&&s.size[1]<=0))throw new Error('Geometría inválida: revisa posición, tamaño y giro.');
}
export function shapeGeometry(s,plane=false){
  validateShape(s,plane);
  const g=s.vertices&&!plane?new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(s.vertices.flatMap(v=>v.map((n,i)=>n*s.size[i])),3)).setIndex(s.indices):plane?new THREE.PlaneGeometry(s.size[0],s.size[2]).rotateX(-Math.PI/2):new THREE.BoxGeometry(...s.size);
  if(s.vertices)g.computeVertexNormals();
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...s.center),new THREE.Quaternion().setFromEuler(new THREE.Euler(...s.rotation.map(THREE.MathUtils.degToRad))),new THREE.Vector3(1,1,1));
  return g.applyMatrix4(matrix);
}
// This is the same provisional floor rule used by the exporter, now inspectable.
export function automaticRoadway(mesh){
  const g=mesh.geometry,p=g.attributes.position;if(!p)return new THREE.BufferGeometry();
  if(!g.attributes.normal)g.computeVertexNormals();
  const n=g.attributes.normal,index=g.index,nm=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld),values=[];
  const count=index?index.count:p.count;
  for(let i=Math.max(0,g.drawRange.start);i+2<Math.min(count,g.drawRange.start+g.drawRange.count);i+=3){
    const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
    if(!upwardTriangle(mesh,ids))continue;
    const mi=g.groups.find(group=>i>=group.start&&i<group.start+group.count)?.materialIndex||0;
    const mat=Array.isArray(mesh.material)?mesh.material[mi]||mesh.material[0]:mesh.material;if(mat?.visible===false)continue;
    ids.forEach(id=>values.push(p.getX(id),p.getY(id),p.getZ(id)));
  }
  const result=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(values,3));result.computeVertexNormals();return result;
}
export function splitShape(shape,axis){
  if(shape.vertices)throw Error('Este componente sigue la superficie del modelo. Edita la pieza original para cambiar su contorno.');
  validateShape(shape);const index='xyz'.indexOf(axis);if(index<0)throw new Error('Eje de división inválido.');
  const direction=new THREE.Vector3().setComponent(index,1).applyEuler(new THREE.Euler(...shape.rotation.map(THREE.MathUtils.degToRad)));
  return [-1,1].map(sign=>({...structuredClone(shape),center:new THREE.Vector3(...shape.center).addScaledVector(direction,sign*shape.size[index]/4).toArray(),size:shape.size.map((v,i)=>i===index?v/2:v)}));
}
export function rectangularOpening(s,width,height,fromBottom){
  if(s.vertices)throw Error('Este componente sigue la superficie del modelo. Usa un volumen de corte para abrir el hueco.');
  validateShape(s);const [x,y,z]=s.size;
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>=x||height>=y)throw new Error('El hueco debe ser menor que la caja en X e Y y mayor que cero.');
  const parts=[],rotation=new THREE.Euler(...s.rotation.map(THREE.MathUtils.degToRad));
  const add=(size,offset)=>parts.push({...structuredClone(s),size,center:new THREE.Vector3(...offset).applyEuler(rotation).add(new THREE.Vector3(...s.center)).toArray()});
  add([(x-width)/2,y,z],[-(x+width)/4,0,0]);add([(x-width)/2,y,z],[(x+width)/4,0,0]);
  if(fromBottom)add([width,y-height,z],[0,height/2,0]);else{add([width,(y-height)/2,z],[0,(y+height)/4,0]);add([width,(y-height)/2,z],[0,-(y+height)/4,0]);}
  return parts;
}
export function validateMemory(points){
  if(points.some(p=>/^abt_seat_\d+(_exit)?$/i.test(p?.name)))throw new Error('Reserved Memory: abt_seat_N / abt_seat_N_exit');
  if(points.some(p=>/^abt_ladder_\d+_(start|end)$/i.test(p?.name)))throw new Error('Los nombres abt_ladder_N_start/end están reservados para las escaleras.');
  if(points.some(p=>/^abt_light_(pos|switch)(_[0-9]+)?$/i.test(p?.name)))throw new Error('Los nombres abt_light_pos y abt_light_switch están reservados para la luz.');
  for(const p of points){if(!p||typeof p.name!=='string'||! /^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(p.name)||/^door_\d+_(axis|trigger)$/i.test(p.name)||!Array.isArray(p.position)||p.position.length!==3||!p.position.every(Number.isFinite))throw new Error('Punto Memory inválido. Usa un nombre sin espacios y evita los nombres reservados door_N_axis/trigger.');}
}
