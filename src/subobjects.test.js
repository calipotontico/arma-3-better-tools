import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaneGeometry, Mesh, Group, ObjectLoader } from 'three';
import { invertTriangles, facesFromPoints, triangleIndices } from './subobjects.js';
import { History, cloneScene } from './history.js';

for(const indexed of [true,false])test(`Partial face inversion isolates adjacent normals and UVs (${indexed})`,async()=>{
  const source=indexed?new PlaneGeometry():new PlaneGeometry().toNonIndexed();
  const original=source.index?source.toNonIndexed():source;
  const changed=invertTriangles(source,new Set([0]));
  for(const name of ['position','uv']){
    const a=original.attributes[name],b=changed.attributes[name];
    for(let i=0;i<6;i++)for(let c=0;c<a.itemSize;c++)assert.equal(b.getComponent(i,c),a.getComponent(i<3?2-i:i,c));
  }
  assert.equal(changed.attributes.normal.getZ(0),-1);assert.equal(changed.attributes.normal.getZ(3),1);assert.equal(source.attributes.normal.getZ(0),1);
  let root=new Group();root.add(new Mesh(source));const history=new History(()=>cloneScene(root),s=>root=cloneScene(s));history.record('face');root.children[0].geometry=changed;history.undo();assert.equal(root.children[0].geometry,source);history.redo();
  const loaded=await new ObjectLoader().parseAsync(root.toJSON());assert.equal(loaded.children[0].geometry.attributes.normal.getZ(0),-1);assert.equal(loaded.children[0].geometry.attributes.normal.getZ(3),1);
  assert.throws(()=>invertTriangles(source,new Set([20])),/inválida/);
});
test('Points select only faces with every corner selected',()=>{
  const g=new PlaneGeometry(),ids=triangleIndices(g,0);
  assert.deepEqual(facesFromPoints(g,new Set(ids)),[0]);assert.deepEqual(facesFromPoints(g,new Set(ids.slice(1))),[]);
});
