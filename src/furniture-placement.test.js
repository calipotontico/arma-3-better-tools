import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {floorPlacement,gridPlacement,rotatePlacement,applyPlacement,duplicateRow} from './furniture-placement.js';
import {seatDefaults,collectSeats} from './seats.js';
import {exportModel} from './arma/export-model.js';
function fixture(){
  const root=new THREE.Group(),chair=new THREE.Mesh(new THREE.BoxGeometry(.5,1,.5),new THREE.MeshStandardMaterial());
  chair.position.set(.37,3,.64);chair.userData.armaSeat=seatDefaults(chair);root.add(chair);return {root,chair};
}
test('floor uses transformed surfaces, excludes selected furniture and supports grid fallback',()=>{
  const {root,chair}=fixture(),floor=new THREE.Mesh(new THREE.BoxGeometry(10,.2,10));floor.position.y=1;root.add(floor);
  applyPlacement(floorPlacement(root,[chair]));
  assert.ok(Math.abs(new THREE.Box3().setFromObject(chair).min.y-1.1)<1e-6);
  floor.visible=false;applyPlacement(floorPlacement(root,[chair]));
  assert.ok(Math.abs(new THREE.Box3().setFromObject(chair).min.y)<1e-6);
});
test('grid and rotations preserve height, seat offsets, scale and project reload',()=>{
  const {root,chair}=fixture();root.updateMatrixWorld(true);
  applyPlacement(gridPlacement([chair],.25));
  let c=new THREE.Box3().setFromObject(chair).getCenter(new THREE.Vector3());
  assert.equal(c.y,3);assert.ok(Math.abs(c.x-.25)<1e-7);assert.ok(Math.abs(c.z-.75)<1e-7);
  applyPlacement(rotatePlacement([chair],90));
  const reloaded=new THREE.ObjectLoader().parse(root.toJSON()),seat=collectSeats(reloaded)[0];
  assert.ok(Math.abs(seat.heading+90)<1e-6);
  assert.deepEqual(reloaded.children[0].userData.armaSeat.exit,chair.userData.armaSeat.exit);
});
test('row uses exact world spacing under rotated parents and exports independent seats with shared model',()=>{
  const {root,chair}=fixture();root.rotation.y=.4;root.updateMatrixWorld(true);
  const start=chair.getWorldPosition(new THREE.Vector3()),copies=duplicateRow(root,chair,{},3,1.5,'x');
  copies.forEach((copy,i)=>{const p=copy.getWorldPosition(new THREE.Vector3());assert.ok(Math.abs(p.x-start.x-(i+1)*1.5)<1e-6);assert.ok(Math.abs(p.z-start.z)<1e-6);});
  assert.equal(collectSeats(root).length,4);
  const result=exportModel(root,{}, {id:'row_test',label:'Row',scale:1,collision:true,roadway:true});
  assert.equal(result.stats.proxies,4);assert.equal(result.proxyModels.length,1);
  assert.throws(()=>duplicateRow(root,chair,{},51,1,'x'));assert.equal(root.children.length,4);
});
