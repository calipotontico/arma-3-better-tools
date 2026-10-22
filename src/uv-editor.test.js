import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,PlaneGeometry,ObjectLoader} from 'three';
import {transformUV,uvEdges,transformUVFaces,uvVertices,moveUVVertices,uvViewPoint,zoomUVView} from './uv-editor.js';
import {History,cloneScene} from './history.js';

test('UV zoom anchors the cursor and panning preserves precise vertex drag coordinates',()=>{
  const start={zoom:2,x:-.3,y:.1},cursor=[.23,.78],before=uvViewPoint(start,...cursor);
  const zoomed=zoomUVView(start,...cursor,4),after=uvViewPoint(zoomed,...cursor);
  before.forEach((v,i)=>assert.ok(Math.abs(v-after[i])<1e-12));
  const panned={...zoomed,x:zoomed.x+.2,y:zoomed.y-.1};
  const at=uvViewPoint(panned,cursor[0]+.2,cursor[1]-.1);
  before.forEach((v,i)=>assert.ok(Math.abs(v-at[i])<1e-12));
  const moved=uvViewPoint(panned,cursor[0]+.28,cursor[1]-.06);
  assert.ok(Math.abs(moved[0]-at[0]-.01)<1e-12);assert.ok(Math.abs(moved[1]-at[1]+.005)<1e-12);
  for(const factor of [1e-8,1e8]){const limited=zoomUVView(start,...cursor,factor);assert.ok(limited.zoom>=.1&&limited.zoom<=100);uvViewPoint(limited,...cursor).forEach((v,i)=>assert.ok(Math.abs(v-before[i])<1e-12));}
});

test('UV vertex drag moves matching corners without altering positions, seams or source and supports undo/save',async()=>{
  const source=new PlaneGeometry(2,2).toNonIndexed(),groups=uvVertices(source);
  assert.equal(groups.length,4);
  const group=groups.find(v=>v.ids.length===2),ids=new Set(group.ids),next=moveUVVertices(source,ids,.2,-.3);
  for(let i=0;i<source.attributes.uv.count;i++){
    assert.ok(Math.abs(next.attributes.uv.getX(i)-source.attributes.uv.getX(i)-(ids.has(i)?.2:0))<1e-6);
    assert.ok(Math.abs(next.attributes.uv.getY(i)-source.attributes.uv.getY(i)-(ids.has(i)?-.3:0))<1e-6);
  }
  assert.deepEqual(Array.from(next.attributes.position.array),Array.from(source.attributes.position.array));
  const seam=source.clone();seam.attributes.uv.setX(group.ids[0],.42);assert.equal(uvVertices(seam).length,5);
  let root=new Group();root.add(new Mesh(source));const history=new History(()=>cloneScene(root),r=>{root=cloneScene(r);});history.record('Mover vértices UV');root.children[0].geometry=next;
  const loaded=await new ObjectLoader().parseAsync(root.toJSON());assert.deepEqual(Array.from(loaded.children[0].geometry.attributes.uv.array),Array.from(next.attributes.uv.array));
  history.undo();assert.equal(root.children[0].geometry,source);history.redo();assert.equal(root.children[0].geometry,next);
  const indexed=new PlaneGeometry();assert.equal(moveUVVertices(indexed,new Set([0]),.1,0).index.count,indexed.index.count);
  assert.throws(()=>moveUVVertices(source,new Set([999]),0,0));assert.throws(()=>moveUVVertices(source,ids,NaN,0));
});

test('UV adjustment is isolated, reversible and survives saving the project',async()=>{
  let root=new Group();const source=new PlaneGeometry(1,1),mesh=new Mesh(source),other=new Mesh(source);root.add(mesh,other);
  const old=Array.from(source.attributes.uv.array),history=new History(()=>cloneScene(root),r=>{root=cloneScene(r);});
  const updated=transformUV(source,{x:.1,y:.2,angle:90,scaleX:.5,scaleY:.5});
  history.record('UV');mesh.geometry=updated;
  assert.deepEqual(Array.from(other.geometry.attributes.uv.array),old);
  const uv=updated.attributes.uv;assert.ok(Math.abs(uv.getX(0)-.35)<1e-6);assert.ok(Math.abs(uv.getY(0)-.45)<1e-6);
  const loaded=await new ObjectLoader().parseAsync(root.toJSON());assert.deepEqual(Array.from(loaded.children[0].geometry.attributes.uv.array),Array.from(uv.array));
  history.undo();assert.deepEqual(Array.from(root.children[0].geometry.attributes.uv.array),old);
  history.redo();assert.deepEqual(Array.from(root.children[0].geometry.attributes.uv.array),Array.from(uv.array));
  assert.deepEqual(Array.from(updated.attributes.position.array),Array.from(source.attributes.position.array));
});
test('UV export emits unique triangle edges for indexed and nonindexed layouts and respects draw range',()=>{
  const plane=new PlaneGeometry(1,1);assert.equal(uvEdges(plane).length,5);assert.equal(uvEdges(plane.toNonIndexed()).length,5);
  plane.setDrawRange(0,3);assert.equal(uvEdges(plane).length,3);
  assert.throws(()=>transformUV(plane,{x:NaN}),/válidos/);assert.throws(()=>transformUV(plane,{scaleX:0}),/válidos/);
});
test('Face UV edits detach shared corners without moving neighbouring UVs or model vertices',async()=>{
  const source=new PlaneGeometry(2,2);source.userData.weldGroups=[[0,1]];
  const original=source.toNonIndexed(),next=transformUVFaces(source,new Set([0]),{x:.25,y:.1});
  assert.equal(next.index,null);for(let i=3;i<6;i++){assert.equal(next.attributes.uv.getX(i),original.attributes.uv.getX(i));assert.equal(next.attributes.uv.getY(i),original.attributes.uv.getY(i));}
  assert.ok(Math.abs(next.attributes.uv.getX(0)-original.attributes.uv.getX(0)-.25)<1e-6);
  assert.deepEqual(Array.from(next.attributes.position.array),Array.from(original.attributes.position.array));
  assert.equal(source.attributes.uv.getX(0),0);assert.ok(next.userData.weldGroups[0].length>=2);
  let root=new Group();root.add(new Mesh(source));const history=new History(()=>cloneScene(root),r=>{root=cloneScene(r);});history.record('UV');root.children[0].geometry=next;
  const loaded=await new ObjectLoader().parseAsync(root.toJSON());assert.deepEqual(Array.from(loaded.children[0].geometry.attributes.uv.array),Array.from(next.attributes.uv.array));history.undo();assert.equal(root.children[0].geometry,source);history.redo();assert.equal(root.children[0].geometry,next);
});
