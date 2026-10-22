import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Mesh, BoxGeometry, Group } from 'three';
import { meshesInRectangle } from './viewport-input.js';

test('Marquee contains complete objects, includes depth and excludes hidden or behind-camera objects',()=>{
  const camera=new PerspectiveCamera(60,1,.1,100);camera.position.z=10;camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const center=new Mesh(new BoxGeometry()),back=new Mesh(new BoxGeometry());back.position.z=-2;
  const outside=new Mesh(new BoxGeometry());outside.position.x=8;
  const behind=new Mesh(new BoxGeometry());behind.position.z=15;
  const hidden=new Mesh(new BoxGeometry()),parent=new Group();parent.visible=false;parent.add(hidden);
  const candidates=[center,back,outside,behind,hidden],rect={minX:-.2,maxX:.2,minY:-.2,maxY:.2};
  assert.deepEqual(meshesInRectangle(candidates,camera,rect),[center,back]);
  assert.deepEqual(meshesInRectangle([center],camera,{...rect,maxX:0}),[]);
});
