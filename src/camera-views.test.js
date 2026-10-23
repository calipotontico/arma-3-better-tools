import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3,Box3} from 'three';
import {setFixedView,viewDirections} from './camera-views.js';
test('Fixed views align to all six axes and frame the model at narrow aspect ratios',()=>{
 for(const aspect of [.4,2])for(const [view,direction] of Object.entries(viewDirections)){
  const camera=new PerspectiveCamera(45,aspect,.01,1000),controls={target:new Vector3(),enableDamping:true,enableRotate:true,update(){}};
  const box=new Box3(new Vector3(-3,-1,-2),new Vector3(7,4,5));setFixedView(camera,controls,view,box);camera.updateMatrixWorld();
  assert.ok(camera.position.clone().sub(controls.target).normalize().distanceTo(new Vector3(...direction))<1e-6);
  assert.equal(controls.enableRotate,false);assert.equal(controls.enableDamping,true);
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&Math.abs(p.z)<1);}
 }
});
