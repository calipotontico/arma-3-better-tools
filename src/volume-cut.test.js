import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {cutShape,cutGeometry,prepareVolumeCut} from './volume-cut.js';
import {shapeGeometry} from './layers.js';
const box=(min,max)=>new T.Box3(new T.Vector3(...min),new T.Vector3(...max));
test('collision subtraction leaves exact convex boxes around an interior cavity',()=>{
  const shape={name:'Building',center:[0,1.5,0],size:[6,3,8],rotation:[0,0,0]},cut=box([-2.8,.1,-3.8],[2.8,2.9,3.8]);
  const parts=cutShape(shape,cut),volume=parts.reduce((n,s)=>n+s.size.reduce((a,b)=>a*b,1),0);
  assert.equal(parts.length,6);assert.ok(Math.abs(volume-(144-5.6*2.8*7.6))<1e-8);
  for(const p of parts){const g=shapeGeometry(p);g.computeBoundingBox();const intersection=g.boundingBox.intersect(cut);assert.ok(intersection.getSize(new T.Vector3()).toArray().some(n=>n<1e-6));}
  assert.deepEqual(cutShape(shape,box([20,20,20],[21,21,21])),[shape]);
  assert.deepEqual(cutShape(shape,box([-10,-10,-10],[10,10,10])),[]);
  assert.throws(()=>cutShape({...shape,rotation:[0,25,0]},cut));
});
test('facade cut preserves UV interpolation and material and clears only the opening',()=>{
  const g=new T.PlaneGeometry(6,3),cut=box([-.5,-1.6,-.2],[.5,.6,.2]);g.clearGroups();g.addGroup(0,6,2);
  const before=Array.from(g.attributes.position.array),r=cutGeometry(g,cut);
  assert.equal(r.affected,2);assert.deepEqual(Array.from(g.attributes.position.array),before);
  const m=new T.Mesh(r.geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));m.updateMatrixWorld(true);
  const hit=x=>new T.Raycaster(new T.Vector3(x,0,2),new T.Vector3(0,0,-1)).intersectObject(m).length;
  assert.equal(hit(0),0);assert.ok(hit(1)>0);
  assert.ok(r.geometry.groups.every(s=>s.materialIndex===2));
  const p=r.geometry.attributes.position,uv=r.geometry.attributes.uv;
  for(let i=0;i<p.count;i++){assert.ok(Math.abs(uv.getX(i)-(p.getX(i)/6+.5))<1e-6);assert.ok(Math.abs(uv.getY(i)-(p.getY(i)/3+.5))<1e-6);}
});
test('cut is staged and serializes all three collision layers without changing original mesh',()=>{
  const mesh=new T.Mesh(new T.BoxGeometry(6,3,8)),before=mesh.geometry;
  const cut=box([-.5,-1.5,-5],[.5,.6,0]),plan=prepareVolumeCut(mesh,cut);
  assert.equal(mesh.geometry,before);assert.equal(mesh.userData.armaLayers,undefined);
  assert.deepEqual(plan.layers.geometry,plan.layers.fire);assert.deepEqual(plan.layers.geometry,plan.layers.view);
  const parts=plan.layers.geometry.map(s=>new T.Mesh(shapeGeometry(s)));parts.forEach(m=>m.updateMatrixWorld(true));
  assert.equal(new T.Raycaster(new T.Vector3(0,0,-6),new T.Vector3(0,0,1),0,5).intersectObjects(parts).length,0);
});

test('interior and doorway clear overlapping collision meshes, preserve moving doors and survive saving',async()=>{
 const {prepareBuildingVolumeCut}=await import('./volume-cut.js'),{setShapes,shapesFor}=await import('./layers.js');
 const root=new T.Group(),wall=new T.Mesh(new T.BoxGeometry(6,3,8)),duplicate=wall.clone(),door=new T.Mesh(new T.BoxGeometry(1,2,.1));root.add(wall,duplicate,door);root.rotation.y=.4;root.scale.setScalar(.8);root.updateMatrixWorld(true);
 const apply=p=>{if(p.geometry)wall.geometry=p.geometry;for(const c of p.changes)for(const [layer,shapes]of Object.entries(c.layers))setShapes(c.mesh,layer,shapes);};
 const interior=prepareBuildingVolumeCut(root,wall,box([-2.8,-1.4,-3.8],[2.8,1.4,3.8]),false,m=>m!==door);assert.equal(interior.changes.length,2);apply(interior);
 const opening=prepareBuildingVolumeCut(root,wall,box([-.6,-1.5,-4.2],[.6,.8,-3.6]),true,m=>m!==door);assert.equal(opening.changes.length,2);assert.equal(door.userData.armaLayers,undefined);apply(opening);
 const saved=new T.ObjectLoader().parse(root.toJSON());saved.updateMatrixWorld(true);
 for(const layer of ['geometry','fire','view']){
  const collisions=saved.children.slice(0,2).flatMap(m=>shapesFor(m,layer).map(s=>{const c=new T.Mesh(shapeGeometry(s),new T.MeshBasicMaterial({side:T.DoubleSide}));c.applyMatrix4(m.matrixWorld);c.updateMatrixWorld(true);return c;}));
  const origin=new T.Vector3(0,0,-5).applyMatrix4(saved.matrixWorld),direction=new T.Vector3(0,0,1).transformDirection(saved.matrixWorld);
  assert.equal(new T.Raycaster(origin,direction,0,2).intersectObjects(collisions).length,0,layer+' entry must be clear on both meshes');
  const side=new T.Vector3(2,0,-5).applyMatrix4(saved.matrixWorld);assert.ok(new T.Raycaster(side,direction,0,2).intersectObjects(collisions).length>0,layer+' adjacent wall must still block');
 }
});
