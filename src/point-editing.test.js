import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, ObjectLoader } from 'three';
import { movePoints, weldPoints, linkedPoints } from './point-editing.js';
import { invertTriangles } from './subobjects.js';
import { History, cloneScene } from './history.js';
function sample(){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute([0,0,0, 1,0,0, 0,1,0, 2,0,0, 3,0,0, 2,1,0],3));g.setAttribute('uv',new Float32BufferAttribute([0,0,1,0,0,1, .5,.5,1,0,0,1],2));g.computeVertexNormals();g.addGroup(0,3,0);g.addGroup(3,3,1);return g;}
test('Point movement is isolated, reversible, and persists through project reload',async()=>{
  let root=new Group();const source=sample();root.add(new Mesh(source),new Mesh(source));const history=new History(()=>cloneScene(root),s=>root=cloneScene(s));history.record('Move');root.children[0].geometry=movePoints(source,new Set([0]),[0,0,2]);assert.equal(root.children[1].geometry.attributes.position.getZ(0),0);assert.equal(root.children[0].geometry.attributes.position.getZ(0),2);history.undo();assert.equal(root.children[0].geometry,source);history.redo();const loaded=await new ObjectLoader().parseAsync(root.toJSON());assert.equal(loaded.children[0].geometry.attributes.position.getZ(0),2);
});
test('Welding preserves UV seams and makes separated attribute records move together',async()=>{
  const source=sample(),g=weldPoints(source,new Set([0,5]));assert.equal(g.attributes.position.getX(0),1);assert.equal(g.attributes.position.getX(5),1);assert.deepEqual([...g.attributes.uv.array],[...source.attributes.uv.array]);
  const root=new Group();root.add(new Mesh(g));const restored=(await new ObjectLoader().parseAsync(root.toJSON())).children[0].geometry;
  const moved=movePoints(restored,new Set([0]),[0,0,2]);assert.equal(moved.attributes.position.getZ(5),2);assert.equal(source.attributes.position.getX(0),0);
  const flipped=invertTriangles(g,new Set([0]));const linked=linkedPoints(flipped,new Set([2]));assert.ok(linked.has(5));
});
test('Collapsed weld triangles are removed and material groups remain aligned',()=>{
  const source=sample(),g=weldPoints(source,new Set([0,1]));assert.equal(g.index.count,3);assert.deepEqual(g.groups,[{start:0,count:3,materialIndex:1}]);assert.equal(g.drawRange.count,3);
  assert.throws(()=>movePoints(source,new Set([50]),[0,0,0]),/inválido/);assert.throws(()=>weldPoints(source,new Set([0])),/dos puntos/);
});
test('Weld undo restores topology and redo restores the links',()=>{
  let root=new Group();root.add(new Mesh(sample()));const original=root.children[0].geometry;const history=new History(()=>cloneScene(root),s=>root=cloneScene(s));history.record('Weld');root.children[0].geometry=weldPoints(original,new Set([0,3]));history.undo();assert.equal(root.children[0].geometry,original);history.redo();assert.deepEqual([...linkedPoints(root.children[0].geometry,new Set([0]))],[0,3]);
});
