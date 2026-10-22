import * as THREE from 'three';
import {lod,selectRange,writeMlod} from './mlod.js';

export function proxyOwner(mesh,root){
  let result=null;
  for(let p=mesh;p&&p!==root;p=p.parent)if(p.userData.armaProxy)result=p;
  return result;
}
function subset(source,indices){
  const out=lod(source.resolution),points=new Map(),normals=new Map(),faces=new Map();
  const remap=(map,array,old,target)=>{if(!map.has(old)){map.set(old,target.length);target.push([...array[old]]);}return map.get(old);};
  for(const i of indices){
    const f=source.faces[i];faces.set(i,out.faces.length);
    out.faces.push({...f,points:f.points.map(p=>remap(points,source.points,p,out.points)),normals:f.normals?.map(n=>remap(normals,source.normals,n,out.normals))});
  }
  for(const [name,s] of Object.entries(source.selections)){
    const ps=[...s.points].filter(p=>points.has(p)).map(p=>points.get(p)),fs=[...s.faces].filter(f=>faces.has(f)).map(f=>faces.get(f));
    if(ps.length||fs.length)selectRange(out,name,ps,fs);
  }
  out.properties={...source.properties};return out;
}
// Visuals become proxies. Physical, roadway and shadow LODs stay in the building
// so collision/occlusion and interactive Memory points retain their existing behavior.
export function extractProxies(visual,groups,id,scale){
  if(!groups.size)return {visual,models:[],instances:0};
  const excluded=new Set(),resources=new Map(),models=[],placements=[];
  for(const [object,indices] of groups){
    indices.forEach(i=>excluded.add(i));
    const part=subset(visual,indices);
    const pos=new THREE.Vector3(),rot=new THREE.Quaternion(),size=new THREE.Vector3();
    object.matrixWorld.decompose(pos,rot,size);
    rot.normalize();
    const frame=new THREE.Matrix4().compose(pos,rot,new THREE.Vector3(1,1,1)),inverse=frame.clone().invert();
    const invNormal=new THREE.Matrix3().getNormalMatrix(inverse);
    part.points=part.points.map(p=>{
      const v=new THREE.Vector3(p[0]/scale,p[1]/scale,-p[2]/scale).applyMatrix4(inverse);
      return [v.x*scale,v.y*scale,-v.z*scale].map(n=>Math.round(n*1e6)/1e6);
    });
    part.normals=part.normals.map(n=>{
      const v=new THREE.Vector3(-n[0],-n[1],n[2]).applyNormalMatrix(invNormal);
      return [-v.x,-v.y,v.z].map(n=>Math.round(n*1e6)/1e6);
    });
    part.selections={};part.properties={autocenter:'0',LODNoShadow:'1'};
    const key=JSON.stringify([part.points,part.normals,part.faces]);
    let name=resources.get(key);
    if(!name){
      name=`furniture_${models.length+1}`;resources.set(key,name);
      models.push({name,p3d:writeMlod([part]),faces:part.faces.length});
    }
    placements.push({frame,name});
  }
  const main=subset(visual,visual.faces.map((_,i)=>i).filter(i=>!excluded.has(i)));
  for(const [i,{frame,name}] of placements.entries()){
    const base=main.points.length,face=main.faces.length,normal=main.normals.length;
    // Arma proxy triangle: origin, up (length 2), forward (length 1).
    for(const p of [[0,0,0],[0,2,0],[0,0,-1]]){
      const v=new THREE.Vector3(...p).applyMatrix4(frame);
      main.points.push([v.x*scale,v.y*scale,-v.z*scale]);
    }
    main.normals.push([1,0,0]);main.faces.push({points:[base,base+1,base+2],normals:[normal,normal,normal]});
    selectRange(main,`proxy:\\${id}\\${name}.${String(i+1).padStart(3,'0')}`,[base,base+1,base+2],[face]);
  }
  return {visual:main,models,instances:placements.length};
}
