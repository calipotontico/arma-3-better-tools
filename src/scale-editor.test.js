import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, BoxGeometry, Box3, Vector3, ObjectLoader } from 'three';
import { scaleBuilding, humanPosition, setHumanPosition, humanBesideDoor } from './scale-editor.js';
import { proposeAxis } from './door.js';
import { cloneScene, History } from './history.js';

test('Physical scale changes world dimensions, door axes and triggers and resets export multiplier',async()=>{
  let root=new Group();const door=new Mesh(new BoxGeometry(100,210,10));root.add(door);door.position.set(50,105,0);root.userData.armaMemory=[{name:'point',position:[100,200,0]}];root.userData.armaExport={scale:.01};
  let doors={[door.uuid]:{...proposeAxis(door),confirmed:true,trigger:[20,100,5]}};
  const history=new History(()=>({root:cloneScene(root),doors:structuredClone(doors)}),s=>{root=cloneScene(s.root);doors=structuredClone(s.doors);});history.record('scale');scaleBuilding(root,doors,.01);
  assert.ok(Math.abs(new Box3().setFromObject(root).getSize(new Vector3()).y-2.1)<1e-8);assert.deepEqual(doors[door.uuid].trigger,[.2,1,.05]);assert.equal(root.userData.armaExport.scale,1);
  const reloaded=await new ObjectLoader().parseAsync(root.toJSON());assert.ok(Math.abs(new Box3().setFromObject(reloaded).getSize(new Vector3()).y-2.1)<1e-8);
  history.undo();assert.equal(new Box3().setFromObject(root).getSize(new Vector3()).y,210);history.redo();assert.equal(root.userData.armaAppliedScale,.01);
});

test('Human placement persists, follows model scale and supports undo without changing meshes',async()=>{
  let root=new Group();root.add(new Mesh(new BoxGeometry(2,3,4)));root.position.set(4,0,2);root.scale.setScalar(2);
  const originalBounds=new Box3().setFromObject(root);
  const history=new History(()=>cloneScene(root),s=>{root=cloneScene(s);});
  history.record('move human');setHumanPosition(root,new Vector3(6,1,8));
  assert.deepEqual(humanPosition(root).toArray(),[6,1,8]);
  assert.ok(new Box3().setFromObject(root).equals(originalBounds));
  const loaded=await new ObjectLoader().parseAsync(root.toJSON());assert.deepEqual(humanPosition(loaded).toArray(),[6,1,8]);
  history.undo();assert.equal(root.userData.armaHumanPosition,undefined);
  history.redo();assert.deepEqual(humanPosition(root).toArray(),[6,1,8]);
  scaleBuilding(root,{},.5);assert.deepEqual(humanPosition(root).toArray(),[3,.5,4]);
  assert.equal(root.children.length,1);
  assert.throws(()=>setHumanPosition(root,new Vector3(NaN,0,0)));
});

test('Human placement beside doors uses foot height and handles either horizontal orientation',()=>{
  for(const angle of [0,Math.PI/2]){
    const door=new Mesh(new BoxGeometry(1,2.1,.1));door.position.set(3,5.05,2);door.rotation.y=angle;
    const p=humanBesideDoor(door),bounds=new Box3().setFromObject(door);
    assert.ok(Math.abs(p.y-4)<1e-6);assert.ok(!bounds.containsPoint(p));
    assert.ok(p.distanceTo(bounds.getCenter(new Vector3()))<2);
  }
});
