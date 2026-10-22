import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, DoubleSide } from 'three';
import { createFaceOrientation } from './face-orientation.js';

test('Orientation display restores real materials even after render failure and preserves hidden material slots',()=>{
  const root=new Group(),visible=new MeshBasicMaterial(),hidden=new MeshBasicMaterial({visible:false});
  const materials=[visible,hidden],mesh=new Mesh(new BoxGeometry(),materials);root.add(mesh);
  const before=JSON.stringify(root.toJSON()),view=createFaceOrientation();
  assert.throws(()=>view.render(root,()=>{
    assert.equal(mesh.material[0].side,DoubleSide);
    assert.equal(mesh.material[1],hidden);
    assert.notEqual(mesh.material[0],visible);
    throw new Error('render failed');
  }),/render failed/);
  assert.equal(mesh.material,materials);assert.equal(JSON.stringify(root.toJSON()),before);
  view.dispose();
});
