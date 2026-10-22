import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import {doorwayVolume} from './doorway-volume.js';import {shapeGeometry} from './layers.js';
test('doorway follows transformed door, adds clearance and a horizontal walkable threshold',()=>{
 const reference=new T.Mesh(new T.BoxGeometry(12,8,4));reference.rotation.x=-Math.PI/2;reference.scale.setScalar(.8);reference.position.set(3,-2,1);reference.updateMatrixWorld(true);
 const door=new T.Mesh(new T.BoxGeometry(.1,1.1,2.2));door.position.set(0,1,1.1);reference.add(door);reference.updateMatrixWorld(true);const p=doorwayVolume(reference,door);
 assert.ok(p.box.min.z<0);assert.ok(p.box.max.z>2.2);assert.ok(p.box.getSize(new T.Vector3()).x>=1);
 const road=new T.Mesh(shapeGeometry(p.roadway,true),new T.MeshBasicMaterial({side:T.DoubleSide}));reference.add(road);reference.updateMatrixWorld(true);road.geometry.computeBoundingBox();const world=new T.Box3().setFromObject(road);assert.ok(world.max.y-world.min.y<1e-6);assert.ok(Math.abs(world.min.y+2)<1e-6);
 const c=world.getCenter(new T.Vector3());assert.ok(new T.Raycaster(c.clone().add(new T.Vector3(0,1,0)),new T.Vector3(0,-1,0)).intersectObject(road).length);
});
