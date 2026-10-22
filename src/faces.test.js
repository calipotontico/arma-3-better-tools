import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, PlaneGeometry, ObjectLoader } from 'three';
import { invertFaces } from './editing.js';
import { History, cloneScene } from './history.js';

for(const indexed of [true,false])test(`Invert faces preserves UVs and shared objects (${indexed?'indexed':'non-indexed'})`,async()=>{
  const geometry=indexed?new PlaneGeometry(2,3):new PlaneGeometry(2,3).toNonIndexed();
  let root=new Group();const selected=new Mesh(geometry),other=new Mesh(geometry);root.add(selected,other);
  const history=new History(()=>cloneScene(root),s=>{root=cloneScene(s);});history.record('Invert');invertFaces([root,selected]);
  // Overlapping selection must invert each mesh only once.
  const flipped=root.children[0].geometry;
  assert.notEqual(flipped,geometry);assert.equal(geometry.attributes.normal.getZ(0),1);
  assert.equal(flipped.attributes.normal.getZ(0),-1);
  assert.deepEqual([...flipped.attributes.uv.array],[...geometry.attributes.uv.array]);
  assert.equal(flipped.index.getX(0),indexed?geometry.index.getX(2):2);
  history.undo();assert.equal(root.children[0].geometry,geometry);history.redo();assert.equal(root.children[0].geometry.attributes.normal.getZ(0),-1);
  const restored=await new ObjectLoader().parseAsync(root.toJSON());assert.equal(restored.children[0].geometry.attributes.normal.getZ(0),-1);
  const shared=new Mesh(geometry);invertFaces([shared]);assert.equal(geometry.attributes.normal.getZ(0),1);
  invertFaces([restored.children[0]]);assert.equal(restored.children[0].geometry.attributes.normal.getZ(0),1);
});
