import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshBasicMaterial,ObjectLoader} from 'three';
import {modelStats,deleteModelObjects} from './model-tools.js';
test('statistics count hidden parts and deduplicate overlapping selection',()=>{
  const root=new Group(),mesh=new Mesh(new BoxGeometry(),new MeshBasicMaterial());root.add(mesh);mesh.visible=false;
  assert.deepEqual(modelStats([root,mesh]),{objects:1,triangles:12,vertices:24});
  assert.equal(modelStats([null]).objects,0);
});
test('deletion cleans references, preserves unrelated objects and serializes',()=>{
  const root=new Group(),mesh=new Mesh(new BoxGeometry(),new MeshBasicMaterial()),other=mesh.clone();root.add(mesh,other);
  const doors={[mesh.uuid]:{confirmed:true},[other.uuid]:{switchId:mesh.uuid}};
  root.userData.armaLights=[{lampId:other.uuid,switchId:mesh.uuid}];
  root.userData.abtSceneGroups=[{members:[mesh.uuid,other.uuid]}];
  const before=root.toJSON();
  deleteModelObjects(root,[mesh],doors);
  assert.equal(root.children.length,1);assert.equal(doors[mesh.uuid],undefined);assert.equal(doors[other.uuid].switchId,undefined);
  assert.equal(root.userData.armaLights.length,0);
  assert.deepEqual(root.userData.abtSceneGroups[0].members,[other.uuid]);
  assert.equal(new ObjectLoader().parse(root.toJSON()).children.length,1);
  assert.equal(new ObjectLoader().parse(before).children.length,2);
});
