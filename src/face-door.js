import * as THREE from 'three';
import {doorOwner} from './selection.js';
import {proxyOwner} from './arma/proxy-export.js';
import {getLanguage} from './i18n.js';
import {readLights} from './lighting-data.js';
const tr=(es,en)=>getLanguage()==='en'?en:es;
export function prepareFaceDoor(root,entries,doors,thickness){
  const fail=()=>{throw Error(tr('Selecciona un rectángulo plano completo de una sola pieza, con las caras orientadas igual.','Select a complete flat rectangle on one part, with consistently oriented faces.'));};
  if(entries.length!==1||!entries[0].faces.size)fail();
  if(!Number.isFinite(thickness)||thickness<.005||thickness>1)throw Error(tr('El grosor debe estar entre 0,005 y 1 m.','Thickness must be between 0.005 and 1 m.'));
  const {mesh,faces}=entries[0],owner=doorOwner(mesh,root),d=doors[owner?.uuid]||doors[mesh.uuid];
  if(readLights(root).some(light=>light.lampId===mesh.uuid||light.switchId===mesh.uuid)||mesh.morphTargetInfluences)throw Error(tr('Selecciona una pieza fija sin luces ni deformaciones.','Select a fixed part without lights or deformations.'));
  if(mesh===root||mesh.isSkinnedMesh||proxyOwner(mesh,root)||mesh.userData.armaGlass||mesh.userData.armaSeat||mesh.userData.armaLadder||(d&&d.confirmed!==false))throw Error(tr('Selecciona caras de una pieza fija sin comportamientos ni proxies.','Select faces on a static part without behaviors or proxies.'));
  root.updateWorldMatrix(true,true);
  const source=mesh.geometry,g=source.index?source.toNonIndexed():source.clone(),p=g.attributes.position,uv=g.attributes.uv;
  const world=i=>new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);
  const triangles=[...faces].map(f=>{
    if(!Number.isInteger(f)||f<0||f*3<g.drawRange.start||f*3+2>=Math.min(p.count,g.drawRange.start+g.drawRange.count))fail();
    return [0,1,2].map(j=>world(f*3+j));
  });
  const normal=new THREE.Vector3().subVectors(triangles[0][1],triangles[0][0]).cross(new THREE.Vector3().subVectors(triangles[0][2],triangles[0][0])).normalize();
  if(Math.abs(normal.y)>.1||normal.lengthSq()<.9)fail();
  const up=new THREE.Vector3(0,1,0).addScaledVector(normal,-normal.y).normalize(),right=up.clone().cross(normal).normalize();
  const center=new THREE.Box3().setFromPoints(triangles.flat()).getCenter(new THREE.Vector3());
  const frame=new THREE.Matrix4().makeBasis(right,up,normal).setPosition(center),inverse=frame.clone().invert();
  let area=0;const local=[];
  for(const tri of triangles){
    const cross=new THREE.Vector3().subVectors(tri[1],tri[0]).cross(new THREE.Vector3().subVectors(tri[2],tri[0]));
    if(cross.length()<1e-10||cross.clone().normalize().dot(normal)<.9999)fail();
    area+=cross.length()/2;
    for(const v of tri){const q=v.clone().applyMatrix4(inverse);if(Math.abs(q.z)>.0001)fail();local.push(q);}
  }
  const box=new THREE.Box3().setFromPoints(local),size=box.getSize(new THREE.Vector3());
  if(Math.abs(area-size.x*size.y)>Math.max(1e-6,area*1e-5))fail();
  // Validate a single non-overlapping rectangular patch by its boundary.
  const key=v=>[v.x,v.y].map(n=>Math.round(n*1e5)).join(','),edges=new Map();
  for(let i=0;i<local.length;i+=3)for(let j=0;j<3;j++){
    const a=local[i+j],b=local[i+(j+1)%3],k=[key(a),key(b)].sort().join(':');
    const e=edges.get(k)||{a,b,count:0};e.count++;edges.set(k,e);if(e.count>2)fail();
  }
  let perimeter=0;
  for(const e of edges.values())if(e.count===1){
    const onSide=['x','y'].some(axis=>[box.min[axis],box.max[axis]].some(v=>Math.abs(e.a[axis]-v)<.0001&&Math.abs(e.b[axis]-v)<.0001));
    if(!onSide)fail();perimeter+=e.a.distanceTo(e.b);
  }
  if(Math.abs(perimeter-2*(size.x+size.y))>.001)fail();
  const positions=[],uvs=[],groups=[];
  const push=(verts,coords,material)=>{const start=positions.length/3;verts.forEach(v=>positions.push(...v));coords.forEach(v=>uvs.push(...v));groups.push({start,count:3,materialIndex:material});};
  const materialFor=f=>g.groups.find(a=>f*3>=a.start&&f*3<a.start+a.count)?.materialIndex||0;
  [...faces].forEach((f,i)=>{
    const a=local.slice(i*3,i*3+3),tex=[0,1,2].map(j=>uv?[uv.getX(f*3+j),uv.getY(f*3+j)]:[a[j].x/size.x,a[j].y/size.y]);
    push(a.map(v=>[v.x,v.y,0]),tex,materialFor(f));
    push([2,1,0].map(j=>[a[j].x,a[j].y,-thickness]),[2,1,0].map(j=>tex[j]),materialFor(f));
  });
  const corners=[[box.min.x,box.min.y],[box.max.x,box.min.y],[box.max.x,box.max.y],[box.min.x,box.max.y]];
  for(let i=0;i<4;i++){
    const a=corners[i],b=corners[(i+1)%4],length=Math.hypot(b[0]-a[0],b[1]-a[1]),frontA=[...a,0],frontB=[...b,0],backA=[...a,-thickness],backB=[...b,-thickness];
    push([frontA,backA,backB],[[0,0],[0,thickness],[length,thickness]],materialFor([...faces][0]));
    push([frontA,backB,frontB],[[0,0],[length,thickness],[length,0]],materialFor([...faces][0]));
  }
  const doorGeometry=new THREE.BufferGeometry();doorGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));doorGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));doorGeometry.groups=groups;doorGeometry.computeVertexNormals();
  // Keep UV and hard-normal seams, but move coincident corners together.
  const cornersByPosition=[];
  const doorPoints=doorGeometry.attributes.position;
  for(let i=0;i<doorPoints.count;i++){
    const point=new THREE.Vector3().fromBufferAttribute(doorPoints,i);
    let group=cornersByPosition.find(g=>g.point.distanceToSquared(point)<1e-8);
    if(!group){group={point,ids:[]};cornersByPosition.push(group);}
    doorPoints.setXYZ(i,...group.point.toArray());group.ids.push(i);
  }
  doorGeometry.userData.weldGroups=cornersByPosition.map(g=>g.ids);
  doorGeometry.computeVertexNormals();
  const remaining=new THREE.BufferGeometry(),kept=[];
  for(let f=Math.ceil(g.drawRange.start/3);f<Math.floor(Math.min(p.count,g.drawRange.start+g.drawRange.count)/3);f++)if(!faces.has(f)){const start=kept.length;kept.push(f*3,f*3+1,f*3+2);remaining.addGroup(start,3,materialFor(f));}
  for(const [name,attr] of Object.entries(g.attributes)){const values=kept.flatMap(i=>Array.from({length:attr.itemSize},(_,c)=>attr.getComponent(i,c)));remaining.setAttribute(name,new THREE.Float32BufferAttribute(values,attr.itemSize));}
  const door=new THREE.Mesh(doorGeometry,mesh.material);door.matrix.copy(root.matrixWorld).invert().multiply(frame);door.matrixAutoUpdate=false;
  return {source:mesh,remaining,door,empty:kept.length===0};
}
