import test from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,BoxGeometry,Group,Vector3} from 'three';
import {alignLadderVertical,collectLadders,proposeLadderPoints} from './ladders.js';
test('Vertical alignment removes climb drift while preserving facing, heights, radius and start under transforms',()=>{
 const root=new Group(),mesh=new Mesh(new BoxGeometry());root.add(mesh);root.scale.setScalar(2);mesh.rotation.y=.7;mesh.position.set(2,1,3);mesh.userData.armaLadder={start:[0,0,.8],end:[0,3,-.35],radius:2.5};root.updateMatrixWorld(true);
 const before=collectLadders(root)[0];const facing=new Vector3().subVectors(before.end,before.start).setY(0).normalize();alignLadderVertical(mesh);const after=collectLadders(root)[0];assert.deepEqual(after.start.toArray(),before.start.toArray());assert.ok(Math.abs(after.end.y-before.end.y)<1e-8);const delta=new Vector3().subVectors(after.end,after.start).setY(0);assert.ok(Math.abs(delta.length()-.02)<1e-8);assert.ok(delta.normalize().dot(facing)>.99999);assert.equal(after.radius,2.5);
});

import {reviewModel} from './arma/preflight.js';
test('Preflight warns about diagonal drift and clears it after alignment',()=>{const root=new Group(),mesh=new Mesh(new BoxGeometry());root.add(mesh);mesh.userData.armaLadder={start:[0,0,.8],end:[0,3,-.35]};const check=()=>reviewModel(root,{}, {scale:1,collision:false},'en').filter(i=>i.message.includes('drifts horizontally'));assert.equal(check().length,1);alignLadderVertical(mesh);assert.equal(check().length,0);});

test('New ladder defaults retain calibrated distance in world meters after scale and rotation',()=>{
 const root=new Group(),mesh=new Mesh(new BoxGeometry(.6,3,.07));root.add(mesh);root.scale.setScalar(2);root.rotation.y=.7;mesh.position.set(2,1.5,1);root.updateMatrixWorld(true);
 mesh.userData.armaLadder=proposeLadderPoints(mesh);const ladder=collectLadders(root)[0],center=mesh.localToWorld(new Vector3());
 assert.ok(Math.abs(Math.hypot(ladder.start.x-center.x,ladder.start.z-center.z)-.5)<1e-8);
 assert.ok(Math.abs(Math.hypot(ladder.end.x-center.x,ladder.end.z-center.z)-.48)<1e-8);assert.equal(ladder.radius,2.5);
});
