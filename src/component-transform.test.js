import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Matrix4,Vector3} from 'three';
import {transformPoints} from './point-editing.js';
test('component rotation and scale affect selected vertices only, retaining UVs and original geometry',()=>{
  const source=new BoxGeometry(),before=source.attributes.position.array.slice(),uv=source.attributes.uv.array.slice();
  const matrix=new Matrix4().makeRotationZ(Math.PI/2).multiply(new Matrix4().makeScale(2,2,2));
  const result=transformPoints(source,new Set([0]),matrix),expected=new Vector3().fromBufferAttribute(source.attributes.position,0).applyMatrix4(matrix);
  assert.ok(new Vector3().fromBufferAttribute(result.attributes.position,0).distanceTo(expected)<1e-6);
  assert.deepEqual(result.attributes.position.array.slice(3),before.slice(3));assert.deepEqual(source.attributes.position.array,before);assert.deepEqual(result.attributes.uv.array,uv);
  assert.throws(()=>transformPoints(source,new Set([0]),new Matrix4().makeScale(0,1,1)));
});
