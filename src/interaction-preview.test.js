import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {previewPose,setSeatPose} from './interaction-preview.js';
import {collectSeats} from './seats.js';
import {seatingConfig} from './arma/seating-config.js';
test('Seat preview uses exported world origin and heading without adding model geometry',()=>{
  const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());root.add(mesh);
  mesh.position.set(3,2,1);mesh.rotation.y=.7;mesh.scale.setScalar(2);
  mesh.userData.armaSeat={position:[0,0,0],exit:[1,0,0],heading:40,radius:2};
  root.updateWorldMatrix(true,true);
  const original=JSON.stringify(root.toJSON()),pose=previewPose(mesh,'seat'),seat=collectSeats(root)[0];
  assert.ok(pose.position.distanceTo(seat.position)<1e-8);assert.ok(pose.exit.distanceTo(seat.exit)<1e-8);
  assert.ok(Math.abs(pose.heading+THREE.MathUtils.degToRad(seat.heading))<1e-8);
  assert.equal(root.children.length,1);assert.equal(JSON.stringify(root.toJSON()),original);
});
test('Ladder preview follows the Memory path at bottom, middle and top',()=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());mesh.position.set(2,0,3);
  mesh.userData.armaLadder={start:[0,0,0],end:[0,4,.02]};
  const bottom=previewPose(mesh,'ladder',0),middle=previewPose(mesh,'ladder',.5),top=previewPose(mesh,'ladder',1);
  assert.deepEqual(bottom.position.toArray(),[2,0,3]);assert.deepEqual(top.position.toArray(),[2,4,3.02]);
  assert.ok(middle.position.distanceTo(bottom.position.clone().lerp(top.position,.5))<1e-8);
});
test('Seat visibility is checked on both client and server and never ignores building walls',()=>{
  const config=seatingConfig('test_seat',[{name:'seat1',heading:0,radius:2}]);
  const asset=name=>config.assets.find(a=>a.name==='scripts/'+name+'.sqf').text;
  assert.match(asset('seat_init'),/call test_seat_fnc_seatVisible/);
  assert.match(asset('seat_request'),/call test_seat_fnc_seatVisible/);
  assert.match(asset('seat_visible'),/_u,objNull,true,1,"VIEW","GEOM"/);
  assert.match(asset('seat_visible'),/_u,objNull,true,1,"GEOM","VIEW"/);
  assert.match(asset('seat_visible'),/eyeDirection/);
});

test('Moving and rotating seated figure writes mesh-local data and transforms exit with the figure',()=>{
 const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());root.add(mesh);root.rotation.y=.4;mesh.rotation.y=.8;mesh.scale.set(2,3,.5);mesh.position.set(4,2,1);mesh.userData.armaSeat={position:[0,0,0],exit:[1,0,0],heading:0,radius:2};
 const before=previewPose(mesh,'seat'),destination=new THREE.Vector3(7,3,-2);const expectedExit=before.exit.clone().sub(before.position).applyAxisAngle(new THREE.Vector3(0,1,0),2.7-before.heading).add(destination);setSeatPose(mesh,destination,2.7);const result=previewPose(mesh,'seat');assert.ok(result.position.distanceTo(destination)<1e-8);assert.ok(Math.abs(result.heading-2.7)<1e-8);assert.ok(result.exit.distanceTo(expectedExit)<1e-8);assert.ok(Math.abs(result.exit.distanceTo(result.position)-before.exit.distanceTo(before.position))<1e-8);
 const saved=new THREE.ObjectLoader().parse(root.toJSON());assert.ok(previewPose(saved.children[0],'seat').position.distanceTo(destination)<1e-8);
});

test('Seat exit follows a quarter turn and translation without drifting on repeated updates',()=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());mesh.userData.armaSeat={position:[0,0,0],exit:[0,0,-1],heading:0,radius:2};
 setSeatPose(mesh,new THREE.Vector3(2,3,4),Math.PI/2);assert.ok(previewPose(mesh,'seat').exit.distanceTo(new THREE.Vector3(1,3,4))<1e-8);
 for(let i=0;i<100;i++)setSeatPose(mesh,new THREE.Vector3(2,3,4),Math.PI/2);assert.ok(previewPose(mesh,'seat').exit.distanceTo(new THREE.Vector3(1,3,4))<1e-8);
});
