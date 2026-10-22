import * as T from 'three';
// Door bounds are measured in the reference part's coordinates, including all child meshes.
export function doorwayVolume(reference,door){
 reference.updateWorldMatrix(true,true);door.updateWorldMatrix(true,true);const inverse=reference.matrixWorld.clone().invert(),box=new T.Box3();
 door.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++)box.expandByPoint(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld).applyMatrix4(inverse));});
 if(box.isEmpty())throw Error('Door has no geometry');
 const axes=[0,1,2].map(i=>new T.Vector3().setFromMatrixColumn(reference.matrixWorld,i)),lengths=axes.map(v=>v.length()),up=axes.map(v=>Math.abs(v.clone().normalize().y)).indexOf(Math.max(...axes.map(v=>Math.abs(v.clone().normalize().y)))),size=box.getSize(new T.Vector3()),horizontal=[0,1,2].filter(i=>i!==up),depth=horizontal.reduce((a,b)=>size.getComponent(a)*lengths[a]<size.getComponent(b)*lengths[b]?a:b),width=horizontal.find(i=>i!==depth),sign=Math.sign(axes[up].y);
 const base=sign>0?box.min.getComponent(up):box.max.getComponent(up);
 for(const a of [width,up]){box.min.setComponent(a,box.min.getComponent(a)-.04/lengths[a]);box.max.setComponent(a,box.max.getComponent(a)+.04/lengths[a]);}
 const c=box.getCenter(new T.Vector3()),d=Math.max(.8/lengths[depth],size.getComponent(depth)+.4/lengths[depth]);box.min.setComponent(depth,c.getComponent(depth)-d/2);box.max.setComponent(depth,c.getComponent(depth)+d/2);
 const x=new T.Vector3().setComponent(width,1),y=new T.Vector3().setComponent(up,sign),z=new T.Vector3().crossVectors(x,y),q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z)),rotation=new T.Euler().setFromQuaternion(q).toArray().slice(0,3).map(T.MathUtils.radToDeg);
 c.setComponent(up,base);const roadway={name:'ABT doorway '+door.uuid,center:c.toArray(),size:[box.getSize(new T.Vector3()).getComponent(width),0,d],rotation};return {box,roadway,depth};
}
