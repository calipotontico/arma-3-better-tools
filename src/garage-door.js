import {Vector3} from 'three';
// A rigid garage panel uses the existing translation animation and collision selections.
export function garageMotion(object,kind){
 if(!['garage-up','garage-side'].includes(kind))throw Error('Unknown garage motion');object.updateWorldMatrix(true,true);const points=[];object.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++)points.push(new Vector3().fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld));});if(!points.length)throw Error('Empty garage door');
 const minY=points.reduce((n,p)=>Math.min(n,p.y),Infinity),maxY=points.reduce((n,p)=>Math.max(n,p.y),-Infinity);let slide;
 if(kind==='garage-up')slide=[0,maxY-minY+.1,0];else{const mean=points.reduce((a,p)=>a.add(p),new Vector3()).multiplyScalar(1/points.length);let xx=0,zz=0,xz=0;for(const p of points){const x=p.x-mean.x,z=p.z-mean.z;xx+=x*x;zz+=z*z;xz+=x*z;}const angle=.5*Math.atan2(2*xz,xx-zz),axis=new Vector3(Math.cos(angle),0,Math.sin(angle)),projections=points.map(p=>p.dot(axis));slide=axis.multiplyScalar(projections.reduce((n,p)=>Math.max(n,p),-Infinity)-projections.reduce((n,p)=>Math.min(n,p),Infinity)+.1).toArray();}
 return {motion:'translation',garagePreset:kind,slide};
}
