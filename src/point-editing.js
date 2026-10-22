import { BufferGeometry, Vector3 } from 'three';

export function linkedPoints(g,selected){
  const ids=new Set(selected),count=g.attributes.position.count;
  for(const i of ids)if(!Number.isInteger(i)||i<0||i>=count)throw new Error('Punto inválido.');
  let changed=true;while(changed){changed=false;for(const group of g.userData.weldGroups||[])if(group.some(i=>ids.has(i)))for(const i of group)if(!ids.has(i)){ids.add(i);changed=true;}}
  return ids;
}
export function activePoints(g){return g.index?[...new Set(g.index.array)]:Array.from({length:g.attributes.position.count},(_,i)=>i);}
function finish(g){g.attributes.position.needsUpdate=true;g.computeVertexNormals();g.deleteAttribute('tangent');g.computeBoundingBox();g.computeBoundingSphere();return g;}
export function movePoints(source,selected,delta){
  if(!delta.every(Number.isFinite)||delta.length!==3)throw new Error('Desplazamiento inválido.');
  const g=new BufferGeometry().copy(source);delete g.parameters;g.userData=structuredClone(source.userData);
  const p=g.attributes.position;for(const i of linkedPoints(g,selected))p.setXYZ(i,p.getX(i)+delta[0],p.getY(i)+delta[1],p.getZ(i)+delta[2]);return finish(g);
}
export function transformPoints(source,selected,matrix){
  if(!matrix.elements.every(Number.isFinite)||Math.abs(matrix.determinant())<1e-12)throw new Error('Transformación inválida.');
  const g=new BufferGeometry().copy(source);delete g.parameters;g.userData=structuredClone(source.userData);
  const p=g.attributes.position,v=new Vector3();for(const i of linkedPoints(g,selected)){v.fromBufferAttribute(p,i).applyMatrix4(matrix);p.setXYZ(i,v.x,v.y,v.z);}return finish(g);
}
export function weldPoints(source,selected){
  const ids=linkedPoints(source,selected);if(ids.size<2)throw new Error('Selecciona al menos dos puntos de una misma pieza.');
  if(Object.keys(source.morphAttributes).length)throw new Error('Convierte la pieza a malla estática antes de soldar.');
  const g=new BufferGeometry().copy(source);delete g.parameters;g.userData=structuredClone(source.userData);
  const p=g.attributes.position,unique=new Map();for(const i of ids){const v=new Vector3().fromBufferAttribute(p,i);unique.set(v.toArray().join(','),v);}
  const center=new Vector3();for(const v of unique.values())center.add(v);center.divideScalar(unique.size);
  for(const i of ids)p.setXYZ(i,...center.toArray());
  // UV/normal seams need separate attribute records; keep them linked for later moves.
  g.userData.weldGroups=[...(g.userData.weldGroups||[]).filter(group=>!group.some(i=>ids.has(i))),[...ids]];
  const canonical=new Map(),remap=new Map();for(const i of ids){const key=Object.values(g.attributes).map(a=>Array.from({length:a.itemSize},(_,c)=>a.getComponent(i,c)).join(',')).join('|');if(!canonical.has(key))canonical.set(key,i);remap.set(i,canonical.get(key));}
  const old=g.index?Array.from(g.index.array):Array.from({length:p.count},(_,i)=>i),next=[],prefix=[0];
  for(let f=0;f+2<old.length;f+=3){const tri=old.slice(f,f+3).map(i=>remap.get(i)??i),a=new Vector3().fromBufferAttribute(p,tri[0]),b=new Vector3().fromBufferAttribute(p,tri[1]),c=new Vector3().fromBufferAttribute(p,tri[2]);
    const affected=old.slice(f,f+3).some(i=>ids.has(i));if(!affected||b.sub(a).cross(c.sub(a)).lengthSq()>1e-20)next.push(...tri);prefix.push(next.length);
  }
  const offset=n=>prefix[Math.min(prefix.length-1,Math.floor(n/3))];
  g.groups=g.groups.map(group=>({...group,start:offset(group.start),count:offset(group.start+group.count)-offset(group.start)})).filter(group=>group.count);
  const start=offset(g.drawRange.start),end=offset(Number.isFinite(g.drawRange.count)?g.drawRange.start+g.drawRange.count:old.length);g.setDrawRange(start,end-start);g.setIndex(next);
  return finish(g);
}
