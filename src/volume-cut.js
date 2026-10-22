import * as T from 'three';
import {shapesFor} from './layers.js';
import {getLanguage} from './i18n.js';
import {cutSurfaceShape} from './surface-collision.js';
const tr=(es,en)=>getLanguage()==='en'?en:es;
export function validateCut(box){
  if(box.isEmpty()||![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite)||box.getSize(new T.Vector3()).toArray().some(n=>n<.00001))throw Error(tr('El volumen de corte necesita tres dimensiones positivas.','The cutting volume needs three positive dimensions.'));
}
// Subtract an axis-aligned box from triangles, interpolating all vertex attributes.
// Retain exterior polygons; this also works on a single-sided facade.
export function cutGeometry(source,box){
  validateCut(box);
  if(Object.keys(source.morphAttributes||{}).length)throw Error(tr('No se pueden recortar piezas deformables.','Deformable parts cannot be cut.'));
  const g=source.index?source.toNonIndexed():source.clone(),p=g.attributes.position;
  const attrs=Object.entries(g.attributes).filter(([name])=>name!=='tangent');
  if(attrs.some(([,a])=>a.itemSize>4))throw Error('Unsupported vertex attribute');
  const values=Object.fromEntries(attrs.map(([name])=>[name,[]])),groups=[];
  const axes=[['x',0],['y',1],['z',2]],planes=axes.flatMap(([axis,i])=>[{i,k:box.min[axis],sign:1},{i,k:box.max[axis],sign:-1}]);
  function split(poly,plane){
    const inside=[],outside=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],da=(a.position[plane.i]-plane.k)*plane.sign,db=(b.position[plane.i]-plane.k)*plane.sign;
      (da>=0?inside:outside).push(a);
      if((da<0&&db>0)||(da>0&&db<0)){
        const t=da/(da-db),v=Object.fromEntries(attrs.map(([name])=>[name,a[name].map((n,c)=>n+(b[name][c]-n)*t)]));inside.push(v);outside.push(v);
      }
    }return {inside,outside};
  }
  const emit=(poly,material)=>{for(let i=1;i<poly.length-1;i++){
    const tri=[poly[0],poly[i],poly[i+1]],a=new T.Vector3(...tri[0].position),b=new T.Vector3(...tri[1].position),c=new T.Vector3(...tri[2].position);
    if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-18)continue;
    const start=values.position.length/3;for(const v of tri)for(const [name]of attrs)values[name].push(...v[name]);groups.push({start,count:3,materialIndex:material});
  }};
  let affected=0;
  for(let i=g.drawRange.start;i+2<Math.min(p.count,g.drawRange.start+g.drawRange.count);i+=3){
    const original=[0,1,2].map(j=>Object.fromEntries(attrs.map(([name,a])=>[name,Array.from({length:a.itemSize},(_,c)=>a.getComponent(i+j,c))])));
    const material=g.groups.find(s=>i>=s.start&&i<s.start+s.count)?.materialIndex||0;
    let remaining=original;const exterior=[];
    for(const plane of planes){if(!remaining.length)break;const pieces=split(remaining,plane);exterior.push(pieces.outside);remaining=pieces.inside;}
    if(remaining.length>=3){affected++;for(const poly of exterior)emit(poly,material);}else emit(original,material);
  }
  const out=new T.BufferGeometry();for(const [name,a]of attrs)out.setAttribute(name,new T.Float32BufferAttribute(values[name],a.itemSize));out.groups=groups;
  if(out.attributes.normal){const n=out.attributes.normal,v=new T.Vector3();for(let i=0;i<n.count;i++){v.fromBufferAttribute(n,i).normalize();n.setXYZ(i,v.x,v.y,v.z);}}else out.computeVertexNormals();
  out.computeBoundingBox();out.computeBoundingSphere();g.dispose();return {geometry:out,affected};
}

export function cutShape(shape,box){
  if(shape.vertices)return cutSurfaceShape(shape,box);
  const q=new T.Quaternion().setFromEuler(new T.Euler(...shape.rotation.map(T.MathUtils.degToRad))),matrix=new T.Matrix4().compose(new T.Vector3(...shape.center),q,new T.Vector3(1,1,1));
  // Restrict to parallel box axes so the exact result stays editable as boxes.
  const inverse=matrix.clone().invert(),rot=new T.Matrix4().makeRotationFromQuaternion(q).elements;
  if([0,1,2,4,5,6,8,9,10].some(i=>Math.abs(rot[i])>1e-6&&Math.abs(Math.abs(rot[i])-1)>1e-6))throw Error(tr('Una caja tiene giro oblicuo. Alinea su giro antes de recortarla.','A collision box is rotated obliquely. Align its rotation before cutting it.'));
  const cut=box.clone().applyMatrix4(inverse),half=new T.Vector3(...shape.size).multiplyScalar(.5),original=new T.Box3(half.clone().negate(),half),intersection=original.clone().intersect(cut);
  if(intersection.isEmpty()||intersection.getSize(new T.Vector3()).toArray().some(n=>n<=1e-8))return [structuredClone(shape)];
  const remaining=original.clone(),parts=[];
  for(const axis of ['x','y','z']){
    if(intersection.min[axis]>remaining.min[axis]+1e-8){const b=remaining.clone();b.max[axis]=intersection.min[axis];parts.push(b);remaining.min[axis]=intersection.min[axis];}
    if(intersection.max[axis]<remaining.max[axis]-1e-8){const b=remaining.clone();b.min[axis]=intersection.max[axis];parts.push(b);remaining.max[axis]=intersection.max[axis];}
  }
  return parts.map(b=>({...structuredClone(shape),center:b.getCenter(new T.Vector3()).applyMatrix4(matrix).toArray(),size:b.getSize(new T.Vector3()).toArray()}));
}

export function prepareVolumeCut(mesh,box,visual=true){
  validateCut(box);
  const layers=Object.fromEntries(['geometry','fire','view'].map(layer=>[layer,shapesFor(mesh,layer).flatMap(s=>cutShape(s,box))]));
  if(Object.values(layers).some(shapes=>shapes.length>256))throw Error(tr('Demasiadas cajas; simplifica las colisiones antes de continuar.','Too many boxes; simplify collisions before continuing.'));
  const result=visual?cutGeometry(mesh.geometry,box):{geometry:null,affected:0};
  return {...result,layers};
}

// Stage every overlapping static collision layer before modifying any mesh.
export function prepareBuildingVolumeCut(root,source,box,visual,eligible=()=>true){
  root.updateWorldMatrix(true,true);
  const result=prepareVolumeCut(source,box,visual),changes=[{mesh:source,layers:result.layers}];
  try{root.traverse(mesh=>{
    if(mesh===source||!mesh.isMesh||!eligible(mesh))return;
    if(Math.abs(mesh.matrixWorld.determinant())<1e-12)throw Error('Collision mesh has zero scale');
    const transform=mesh.matrixWorld.clone().invert().multiply(source.matrixWorld),local=box.clone().applyMatrix4(transform);
    const layers=['geometry','fire','view'];
    const overlaps=layers.some(layer=>shapesFor(mesh,layer).some(shape=>{
      const m=new T.Matrix4().compose(new T.Vector3(...shape.center),new T.Quaternion().setFromEuler(new T.Euler(...shape.rotation.map(T.MathUtils.degToRad))),new T.Vector3(1,1,1));
      const half=new T.Vector3(...shape.size).multiplyScalar(.5),b=new T.Box3(half.clone().negate(),half).applyMatrix4(m).intersect(local);
      return !b.isEmpty()&&b.getSize(new T.Vector3()).toArray().every(n=>n>1e-8);
    }));
    mesh.geometry.computeBoundingBox();const touchesVisual=visual&&mesh.geometry.boundingBox.intersectsBox(local);
    if(!overlaps&&!touchesVisual)return;
    const aligned=[0,1,2].every(i=>new T.Vector3().setFromMatrixColumn(transform,i).normalize().toArray().filter(n=>Math.abs(n)>1e-6).length===1);
    if(!aligned)throw Error(tr('Hay otra colisión con ejes oblicuos en el hueco: ','Another collision has oblique axes in the opening: ')+(mesh.name||mesh.uuid));
    const next=prepareVolumeCut(mesh,local,visual);changes.push({mesh,layers:next.layers,geometry:next.geometry,affected:next.affected});
  });return {...result,affected:result.affected+changes.slice(1).reduce((n,c)=>n+(c.affected||0),0),changes,collisionChanged:changes.some(c=>Object.entries(c.layers).some(([layer,shapes])=>JSON.stringify(shapes)!==JSON.stringify(shapesFor(c.mesh,layer))))};}catch(error){result.geometry?.dispose();for(const c of changes)c.geometry?.dispose();throw error;}
}
