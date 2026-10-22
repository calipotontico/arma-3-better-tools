import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, BoxGeometry, PlaneGeometry, Group, ObjectLoader } from 'three';
import { defaultShape, rectangularOpening, setShapes, shapesFor } from './layers.js';
import { planRecalculation, applyRecalculation } from './recalculate.js';
import { History, cloneScene } from './history.js';

test('Floor recalculation preserves a stair opening, undo, redo and saved project',async()=>{
  let root=new Group();const m=new Mesh(new BoxGeometry(6,.2,6));root.add(m);
  const patch=(center,size)=>({name:'Floor',center,size,rotation:[0,0,0]});
  setShapes(m,'roadway',[patch([-2,.1,0],[2,0,6]),patch([2,.1,0],[2,0,6]),patch([0,.1,-2],[2,0,2]),patch([0,.1,2],[2,0,2])]);
  const original=structuredClone(m.userData.armaLayers.roadway);
  m.geometry=new BoxGeometry(12,.4,18);m.geometry.translate(0,2,0);
  const history=new History(()=>cloneScene(root),s=>root=cloneScene(s));history.record('Recalculate');applyRecalculation([planRecalculation(m)]);
  const result=structuredClone(m.userData.armaLayers.roadway);assert.equal(result.length,4);
  for(const s of result){assert.ok(Math.abs(s.center[1]-2.2)<1e-6);assert.equal(s.size[1],0);const minX=s.center[0]-s.size[0]/2,maxX=s.center[0]+s.size[0]/2,minZ=s.center[2]-s.size[2]/2,maxZ=s.center[2]+s.size[2]/2;assert.ok(!(minX<0&&maxX>0&&minZ<0&&maxZ>0),'stair opening must stay empty');}
  history.undo();assert.deepEqual(root.children[0].userData.armaLayers.roadway,original);history.redo();assert.deepEqual(root.children[0].userData.armaLayers.roadway,result);
  root=await new ObjectLoader().parseAsync(root.toJSON());assert.deepEqual(root.children[0].userData.armaLayers.roadway,result);
});
test('Automatic, excluded and flat floors keep their distinct behaviour',()=>{
  const automatic=new Mesh(new BoxGeometry(4,.2,4));applyRecalculation([planRecalculation(automatic)]);assert.equal(shapesFor(automatic,'roadway'),null);
  const flat=new Mesh(new PlaneGeometry(4,4));flat.geometry.rotateX(-Math.PI/2);setShapes(flat,'roadway',[{center:[0,0,0],size:[4,0,4],rotation:[0,0,0]}]);flat.geometry.scale(2,1,2);flat.geometry.translate(0,3,0);applyRecalculation([planRecalculation(flat)]);assert.deepEqual(shapesFor(flat,'roadway')[0].size,[8,0,8]);assert.equal(shapesFor(flat,'roadway')[0].center[1],3);
  setShapes(flat,'roadway',[]);applyRecalculation([planRecalculation(flat)]);assert.deepEqual(shapesFor(flat,'roadway'),[]);
});

test('Recalculation scales components together, preserving door and window openings and exclusions',()=>{
  const m=new Mesh(new BoxGeometry(4,3,.2));setShapes(m,'geometry',rectangularOpening(defaultShape(m),1,2,true));setShapes(m,'fire',rectangularOpening(defaultShape(m),1,1,false));setShapes(m,'view',[]);
  m.geometry=m.geometry.clone().scale(2,2,2);applyRecalculation([planRecalculation(m)]);
  assert.equal(m.userData.armaLayers.geometry.length,3);assert.equal(m.userData.armaLayers.fire.length,4);assert.deepEqual(m.userData.armaLayers.view,[]);
  const [left,right,top]=m.userData.armaLayers.geometry;assert.equal(left.center[0]+left.size[0]/2,-1);assert.equal(right.center[0]-right.size[0]/2,1);assert.equal(top.center[1]-top.size[1]/2,1);
  const previous=structuredClone(m.userData.armaLayers);applyRecalculation([planRecalculation(m)]);assert.deepEqual(m.userData.armaLayers,previous);
});
test('Legacy and rotated layers remain intact when a safe proportional update is unavailable',()=>{
  const m=new Mesh(new BoxGeometry(4,3,1));m.userData.armaLayers={geometry:[defaultShape(m)]};const rotated={...defaultShape(m),rotation:[0,45,0]};setShapes(m,'fire',[rotated]);m.geometry=m.geometry.clone().scale(2,1,1);
  const before=structuredClone(m.userData.armaLayers),plan=planRecalculation(m);assert.equal(plan.skipped,2);applyRecalculation([plan]);assert.deepEqual(m.userData.armaLayers.geometry,before.geometry);assert.deepEqual(m.userData.armaLayers.fire,before.fire);
});
test('Scope, undo, redo and serialized reference bounds survive recalculation',async()=>{
  let root=new Group();const a=new Mesh(new BoxGeometry(4,3,1)),b=new Mesh(new BoxGeometry(8,3,1));root.add(a,b);setShapes(a,'geometry',rectangularOpening(defaultShape(a),1,2,true));a.geometry=a.geometry.clone().scale(2,1,1);
  const history=new History(()=>cloneScene(root),s=>root=cloneScene(s));history.record('Recalculate');applyRecalculation([planRecalculation(a)]);assert.equal(b.userData.armaLayers,undefined);const after=structuredClone(a.userData);history.undo();assert.equal(root.children[0].userData.armaLayers.geometry[0].size[0],1.5);history.redo();assert.deepEqual(root.children[0].userData,after);
  root=await new ObjectLoader().parseAsync(root.toJSON());assert.deepEqual(root.children[0].userData,after);
});
