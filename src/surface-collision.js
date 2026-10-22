import * as T from 'three';
// Only referenced, rendered triangles count: split materials often retain unused vertices.
export function activeTriangles(mesh){
 const g=mesh.geometry,p=g.attributes.position,idx=g.index,out=[];if(!p)return out;
 for(let i=Math.max(0,g.drawRange.start);i+2<Math.min(idx?.count??p.count,g.drawRange.start+g.drawRange.count);i+=3){
  const group=g.groups.find(s=>i>=s.start&&i<s.start+s.count),mat=Array.isArray(mesh.material)?mesh.material[group?.materialIndex??0]:mesh.material;if(mat?.visible===false)continue;
  const v=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j));
  const n=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));if(n.lengthSq()>1e-16)out.push({v,n:n.normalize(),offset:i});
 }return out;
}
export function activeBounds(mesh){const b=new T.Box3();for(const t of activeTriangles(mesh))for(const v of t.v)b.expandByPoint(v);return b;}
export function upwardTriangle(mesh,ids){const p=mesh.geometry.attributes.position,v=ids.map(i=>new T.Vector3().fromBufferAttribute(p,i));const n=v[1].sub(v[0]).cross(v[2].sub(v[0])).normalize().applyNormalMatrix(new T.Matrix3().getNormalMatrix(mesh.matrixWorld));return n.y>.7;}
const cache=new WeakMap();
export function surfaceShapes(mesh,fallback){
 const g=mesh.geometry,key=[g.attributes.position.version,g.index?.version,g.drawRange.start,g.drawRange.count,JSON.stringify(g.groups),mesh.matrixWorld.elements.join(','),(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>m?.visible).join(',')].join('|');
 const old=cache.get(mesh);if(old?.g===g&&old.key===key)return old.shapes;
 const tris=activeTriangles(mesh),b=new T.Box3();for(const t of tris)for(const v of t.v)b.expandByPoint(v);
 if(!tris.length)return [];
 const size=b.getSize(new T.Vector3()),world=b.clone().applyMatrix4(mesh.matrixWorld).getSize(new T.Vector3()).toArray().sort((a,b)=>b-a);
 // Plain boxes remain simple editable boxes. Larger non-box pieces follow their surfaces.
 const corners=new Set(tris.flatMap(t=>t.v.map(v=>v.toArray().map((n,i)=>Math.round((n-b.min.getComponent(i))/Math.max(size.getComponent(i),1e-9)*1e5)).join(','))));
 const box=tris.length===12&&corners.size===8&&tris.every(t=>t.n.toArray().filter(n=>Math.abs(n)>1e-5).length===1);
 if(box||world[0]<1.5||world[1]<.6||mesh.userData.armaGlass){const shapes=[fallback()];cache.set(mesh,{g,key,shapes});return shapes;}
 const points=[],pointIds=new Map(),polys=[],planes=new Map();
 const id=v=>{const k=v.toArray().map(n=>Math.round(n/1e-4)).join(',');if(!pointIds.has(k)){pointIds.set(k,points.length);points.push(v);}return pointIds.get(k);};
 for(const t of tris){const ids=t.v.map(id);if(new Set(ids).size<3)continue;const k=[...t.n.toArray().map(n=>Math.round(n/1e-3)),Math.round(t.n.dot(t.v[0])/1e-3)].join(',');if(!planes.has(k))planes.set(k,[]);planes.get(k).push({ids,n:t.n});}
 // Join adjacent coplanar triangles only when the union is convex. Never bridge a hole.
 for(const group of planes.values()){
  const active=new Set(group),edges=new Map();
  const register=p=>{for(let i=0;i<p.ids.length;i++)edges.set(p.ids[i]+','+p.ids[(i+1)%p.ids.length],p);};
  const remove=p=>{active.delete(p);for(let i=0;i<p.ids.length;i++){const k=p.ids[i]+','+p.ids[(i+1)%p.ids.length];if(edges.get(k)===p)edges.delete(k);}};
  group.forEach(register);
  for(const first of group){if(!active.has(first))continue;let a=first,changed=true;
   while(changed){changed=false;for(let i=0;i<a.ids.length;i++){const u=a.ids[i],v=a.ids[(i+1)%a.ids.length],other=edges.get(v+','+u);if(!other||other===a)continue;const j=other.ids.indexOf(v);
    const ids=[...Array.from({length:a.ids.length},(_,k)=>a.ids[(i+1+k)%a.ids.length]),...Array.from({length:other.ids.length-2},(_,k)=>other.ids[(j+2+k)%other.ids.length])];
    if(new Set(ids).size!==ids.length)continue;
    if(ids.some((x,k)=>{const prev=points[ids[(k+ids.length-1)%ids.length]],cur=points[x],next=points[ids[(k+1)%ids.length]];return cur.clone().sub(prev).cross(next.clone().sub(cur)).dot(a.n)<-1e-8;}))continue;
    remove(a);remove(other);a={ids,n:a.n};active.add(a);register(a);changed=true;break;
   }}
  }
  polys.push(...active);
 }
 
 const shapes=polys.map((poly,i)=>{
  poly.ids=poly.ids.filter((id,k,ids)=>{const a=points[ids[(k+ids.length-1)%ids.length]],b=points[id],c=points[ids[(k+1)%ids.length]];return b.clone().sub(a).cross(c.clone().sub(b)).lengthSq()>1e-16;});
  const n=poly.n;
  // Extrude inward: the rendered wall/floor remains the outer collision surface.
  const inverse=mesh.matrixWorld.clone().invert();
  // Normal displacement in local coordinates for arbitrary non-uniform transforms.
  const origin=new T.Vector3().applyMatrix4(inverse),displacement=new T.Vector3().copy(n).applyNormalMatrix(new T.Matrix3().getNormalMatrix(mesh.matrixWorld)).multiplyScalar(-.02).applyMatrix4(inverse).sub(origin);
  const vertices=poly.ids.map(id=>points[id].clone()),count=vertices.length;vertices.push(...vertices.map(v=>v.clone().add(displacement)));
  const bounds=new T.Box3().setFromPoints(vertices),center=bounds.getCenter(new T.Vector3()),s=bounds.getSize(new T.Vector3()).max(new T.Vector3(1e-8,1e-8,1e-8)),indices=[];
  for(let k=1;k<count-1;k++){indices.push(0,k,k+1,count,count+k+1,count+k);}for(let k=0;k<count;k++){const j=(k+1)%count;indices.push(k,count+k,count+j,k,count+j,j);}
  return {name:'Superficie '+(i+1),center:center.toArray(),size:s.toArray(),rotation:[0,0,0],vertices:vertices.map(v=>v.sub(center).divide(s).toArray()),indices};
 });
 cache.set(mesh,{g,key,shapes});return shapes;
}
// Exact convex clipping keeps generated components closed when a doorway is cut later.
export function cutSurfaceShape(shape,box){
 const matrix=new T.Matrix4().compose(new T.Vector3(...shape.center),new T.Quaternion().setFromEuler(new T.Euler(...shape.rotation.map(T.MathUtils.degToRad))),new T.Vector3(...shape.size));
 const vertices=shape.vertices.map(v=>new T.Vector3(...v).applyMatrix4(matrix));
 let remaining=[];for(let i=0;i<shape.indices.length;i+=3)remaining.push(shape.indices.slice(i,i+3).map(j=>vertices[j]));
 const bounds=new T.Box3().setFromPoints(vertices);if(!bounds.intersectsBox(box))return [structuredClone(shape)];
 const pieces=[];
 for(let axis=0;axis<3;axis++)for(const sign of [1,-1]){
  const n=new T.Vector3().setComponent(axis,sign),d=sign===1?box.min.getComponent(axis):-box.max.getComponent(axis);
  const outside=clip(remaining,n,d,false);if(outside.length)pieces.push(outside);remaining=clip(remaining,n,d,true);
 }
 return pieces.map((faces,i)=>polyShape(faces,shape.name+' '+(i+1))).filter(Boolean);
}
function clip(faces,n,d,inside){
 const out=[],caps=[];for(const face of faces){const poly=[];for(let i=0;i<face.length;i++){
  const a=face[i],b=face[(i+1)%face.length],da=a.dot(n)-d,db=b.dot(n)-d,ka=inside?da>=-1e-8:da<=1e-8;
  if(ka)poly.push(a);if((da>1e-8&&db< -1e-8)||(da< -1e-8&&db>1e-8)){const p=a.clone().lerp(b,da/(da-db));poly.push(p);caps.push(p);}
 }if(poly.length>=3)out.push(poly);}
 const unique=[...new Map(caps.map(p=>[p.toArray().map(x=>Math.round(x/1e-8)).join(','),p])).values()];
 if(unique.length>=3){const center=unique.reduce((a,b)=>a.add(b),new T.Vector3()).multiplyScalar(1/unique.length),normal=n.clone().multiplyScalar(inside?-1:1),u=unique[0].clone().sub(center).normalize(),v=normal.clone().cross(u);unique.sort((a,b)=>Math.atan2(a.clone().sub(center).dot(v),a.clone().sub(center).dot(u))-Math.atan2(b.clone().sub(center).dot(v),b.clone().sub(center).dot(u)));out.push(unique);}
 return out;
}
function polyShape(faces,name){
 const points=[],indices=[],map=new Map();
 const id=v=>{const k=v.toArray().map(x=>Math.round(x/1e-8)).join(',');if(!map.has(k)){map.set(k,points.length);points.push(v);}return map.get(k);};
 for(const f of faces){const ids=f.map(id);if(f.length===3){if(f[1].clone().sub(f[0]).cross(f[2].clone().sub(f[0])).lengthSq()>1e-18)indices.push(...ids);continue;}
  const center=f.reduce((sum,v)=>sum.add(v),new T.Vector3()).multiplyScalar(1/f.length),middle=id(center);
  for(let i=0;i<f.length;i++){const j=(i+1)%f.length;if(f[i].clone().sub(center).cross(f[j].clone().sub(center)).lengthSq()>1e-18)indices.push(middle,ids[i],ids[j]);}
 }
 if(points.length<4)return null;const b=new T.Box3().setFromPoints(points),center=b.getCenter(new T.Vector3()),size=b.getSize(new T.Vector3());if(size.toArray().some(x=>x<1e-8))return null;
 return {name,center:center.toArray(),size:size.toArray(),rotation:[0,0,0],vertices:points.map(p=>p.clone().sub(center).divide(size).toArray()),indices};
}
export function usesExistingInterior(mesh){for(let o=mesh;o;o=o.parent)if(o.userData?.armaInteriorMode==='existing')return true;return false;}
