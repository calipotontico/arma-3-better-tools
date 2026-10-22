import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {prepareFaceDoor} from './face-door.js';
function fixture(){
  const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,2),new THREE.MeshStandardMaterial());
  root.add(mesh);return {root,mesh};
}
test('selected plane becomes a closed door with physical thickness and preserved front UV',()=>{
  const {root,mesh}=fixture(),old=mesh.geometry;
  mesh.rotation.y=.5;mesh.scale.set(2,1.5,3);mesh.position.set(3,4,5);
  const r=prepareFaceDoor(root,[{mesh,faces:new Set([0,1])}],{},.04);
  assert.equal(mesh.geometry,old);assert.ok(r.empty);
  r.door.geometry.computeBoundingBox();
  assert.ok(Math.abs(r.door.geometry.boundingBox.getSize(new THREE.Vector3()).z-.04)<1e-6);
  assert.equal(r.door.geometry.attributes.position.count,36);
  const edges=new Map(),p=r.door.geometry.attributes.position;
  const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(x=>x.toFixed(5)).join(',');
  for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){const k=[key(i+j),key(i+(j+1)%3)].sort().join(':');edges.set(k,(edges.get(k)||0)+1);}
  assert.ok([...edges.values()].every(n=>n===2));
  assert.equal(r.door.geometry.attributes.uv.getX(0),old.attributes.uv.getX(old.index.getX(0)));
});
test('partial triangle and nonplanar selections fail without changing the model',()=>{
  const {root,mesh}=fixture(),old=mesh.geometry;
  assert.throws(()=>prepareFaceDoor(root,[{mesh,faces:new Set([0])}],{},.04));
  assert.throws(()=>prepareFaceDoor(root,[{mesh,faces:new Set([0,1])}],{},0));
  assert.equal(mesh.geometry,old);assert.equal(root.children.length,1);
});
test('extracting one box side retains the other source faces and materials',()=>{
  const {root,mesh}=fixture();mesh.geometry=new THREE.BoxGeometry(1,2,.2);
  const r=prepareFaceDoor(root,[{mesh,faces:new Set([8,9])}],{},.05);
  assert.equal(r.remaining.attributes.position.count,30);
  assert.equal(r.remaining.groups.length,10);assert.equal(r.empty,false);
});
