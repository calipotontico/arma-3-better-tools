import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createRoom} from './interiors.js';
import {shapeGeometry} from './layers.js';
import {exportModel} from './arma/export-model.js';
const spec={width:4,depth:5,height:2.8,thickness:.15,openingWidth:1,openingHeight:2.1,openingOffset:.4,x:7,y:2,z:-3,heading:37,ceiling:true};
test('room keeps entrance clear in visual and collision geometry after rotation and save/load',()=>{
  const room=new T.ObjectLoader().parse(createRoom(spec).toJSON());room.updateMatrixWorld(true);
  const ray=(x,y)=>new T.Raycaster(room.localToWorld(new T.Vector3(x,y,-4)),new T.Vector3(0,0,1).transformDirection(room.matrixWorld),0,2);
  assert.equal(ray(.4,1).intersectObject(room,true).length,0);
  assert.ok(ray(-1,1).intersectObject(room,true).length>0);
  assert.ok(ray(.4,2.4).intersectObject(room,true).length>0);
  for(const layer of ['geometry','fire','view']){
    const colliders=[];room.traverse(m=>{if(m.isMesh)for(const shape of m.userData.armaLayers[layer]){const c=new T.Mesh(shapeGeometry(shape));c.matrixAutoUpdate=false;c.matrix.copy(m.matrixWorld);c.updateMatrixWorld(true);colliders.push(c);}});
    for(const y of [.1,1,2])assert.equal(ray(.4,y).intersectObjects(colliders).length,0);
    assert.ok(ray(-1,1).intersectObjects(colliders).length>0);
  }
  const floors=room.children.filter(m=>m.userData.armaLayers.roadway.length);assert.equal(floors.length,1);
  const floor=floors[0],surface=shapeGeometry(floor.userData.armaLayers.roadway[0],true);surface.computeBoundingBox();
  assert.ok(Math.abs(floor.localToWorld(surface.boundingBox.getCenter(new T.Vector3())).y-spec.y)<1e-6);
  const root=new T.Group();root.add(room);const result=exportModel(root,{}, {id:'test_interior',label:'Interior',scale:1,collision:true,roadway:true});assert.ok(result);
});
test('room rejects invalid openings and dimensions without mutating the settings',()=>{
  const before=structuredClone(spec);
  for(const change of [{openingWidth:5},{openingHeight:3},{openingOffset:2},{width:NaN},{thickness:0},{height:200}])assert.throws(()=>createRoom({...spec,...change}));
  assert.deepEqual(spec,before);assert.equal(createRoom({...spec,ceiling:false}).children.length,7);
});

