import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, BoxGeometry, Matrix4, Vector3, ObjectLoader, Group } from 'three';
import { proposeAxis, doorMatrix, groupDoor, detachPiece, ungroupDoor, addDoorPieces } from './door.js';

test('Añadir piezas conserva la puerta existente y las posiciones; después giran y se guardan juntas',async()=>{
  const root=new Group();root.rotation.y=.3;root.scale.set(2,1,.7);
  const leaf=new Mesh(new BoxGeometry(1,2,.1)),handle=new Mesh(new BoxGeometry(.1,.1,.1));
  handle.position.set(.4,1,.1);root.add(leaf,handle);
  const group=groupDoor(root,[leaf]);group.name='Entrada';
  root.updateMatrixWorld(true);const world=handle.matrixWorld.clone(),uuid=group.uuid;
  const config={...proposeAxis(group),pivot:[.3,0,.2],angle:125};
  const result=addDoorPieces(root,group,[handle]);
  assert.equal(result,group);assert.equal(result.uuid,uuid);assert.equal(result.name,'Entrada');
  handle.matrixWorld.elements.forEach((v,i)=>assert.ok(Math.abs(v-world.elements[i])<1e-10));
  const base=group.matrixWorld.clone(),local=group.matrix.clone();group.matrixAutoUpdate=false;
  group.matrix.copy(doorMatrix(base,root.matrixWorld,config.pivot,Math.PI/2));root.updateMatrixWorld(true);
  const expected=doorMatrix(world,new Matrix4(),config.pivot,Math.PI/2);
  handle.matrixWorld.elements.forEach((v,i)=>assert.ok(Math.abs(v-expected.elements[i])<1e-10));
  group.matrix.copy(local);root.updateMatrixWorld(true);
  const saved=JSON.parse(JSON.stringify({model:root.toJSON(),doors:{[uuid]:config}}));
  const loaded=await new ObjectLoader().parseAsync(saved.model);
  assert.equal(loaded.getObjectByProperty('uuid',uuid).children.length,2);
  assert.deepEqual(saved.doors[uuid],config);
});

test('Ampliar una puerta antigua de una pieza conserva su nombre y evita ciclos',()=>{
  const root=new Group(),leaf=new Mesh(new BoxGeometry(1,2,.1)),handle=new Mesh(new BoxGeometry(.1,.1,.1));
  leaf.name='Puerta antigua';root.add(leaf,handle);
  const group=addDoorPieces(root,leaf,[handle]);
  assert.equal(group.name,'Puerta antigua');assert.equal(group.children.length,2);
  addDoorPieces(root,group,[handle]);assert.equal(group.children.length,2);
  assert.throws(()=>addDoorPieces(root,group,[root]),/antecesor/);
  assert.equal(group.parent,root);
});

test('Quitar una pieza conserva su posición y la separa del giro de la puerta',()=>{
  const root=new Group();root.rotation.y=.3;root.scale.set(2,1,.7);
  const leaf=new Mesh(new BoxGeometry(1,2,.1)),handle=new Mesh(new BoxGeometry(.1,.1,.1));
  handle.position.set(.4,1,.1);root.add(leaf,handle);
  const group=groupDoor(root,[leaf,handle]);const world=handle.matrixWorld.clone();
  detachPiece(root,handle);
  assert.equal(handle.parent,root);assert.equal(group.children.length,1);
  group.rotation.y=1;root.updateMatrixWorld(true);
  handle.matrixWorld.elements.forEach((v,i)=>assert.ok(Math.abs(v-world.elements[i])<1e-10));
});

test('Desagrupar elimina grupos de puerta anidados sin perder geometrías ni posiciones',async()=>{
  const root=new Group();root.position.set(3,2,1);
  const a=new Mesh(new BoxGeometry(1,2,.1)),b=new Mesh(new BoxGeometry(.1,.1,.1)),c=new Mesh(new BoxGeometry(.2,.2,.2));
  a.position.x=2;b.position.z=.2;c.position.y=1;root.add(a,b,c);
  const inner=groupDoor(root,[a,b]);const outer=groupDoor(root,[inner,c]);
  const original=[a,b,c].map(o=>o.matrixWorld.clone());
  ungroupDoor(root,outer);root.updateMatrixWorld(true);
  assert.equal(outer.parent,null);
  root.traverse(o=>assert.ok(!o.userData.calipoDoor));
  [a,b,c].forEach((o,j)=>o.matrixWorld.elements.forEach((v,i)=>assert.ok(Math.abs(v-original[j].elements[i])<1e-10)));
  const reopened=await new ObjectLoader().parseAsync(JSON.parse(JSON.stringify(root.toJSON())));
  let count=0;reopened.traverse(o=>{if(o.isMesh)count++;assert.ok(!o.userData.calipoDoor);});assert.equal(count,3);
});

test('Una puerta compuesta conserva las piezas y gira rígidamente, también después de guardar',async()=>{
  const root=new Group();root.position.set(2,1,-3);
  const parent=new Group();parent.rotation.y=.6;parent.scale.set(2,1,.8);root.add(parent);
  const leaf=new Mesh(new BoxGeometry(1,2,.1));leaf.position.set(1,1,0);parent.add(leaf);
  const handle=new Mesh(new BoxGeometry(.2,.1,.1));handle.position.set(4,1,.2);root.add(handle);
  root.updateMatrixWorld(true);
  const original=[leaf.matrixWorld.clone(),handle.matrixWorld.clone()];
  const group=groupDoor(root,[leaf,handle]);
  [leaf,handle].forEach((o,i)=>o.matrixWorld.elements.forEach((v,j)=>assert.ok(Math.abs(v-original[i].elements[j])<1e-10)));
  const base=group.matrixWorld.clone(),axis=proposeAxis(group),local=group.matrix.clone();
  group.matrixAutoUpdate=false;
  group.matrix.copy(doorMatrix(base,root.matrixWorld,axis.pivot,Math.PI/2));root.updateMatrixWorld(true);
  const transform=new Matrix4().makeTranslation(...axis.pivot).multiply(new Matrix4().makeRotationY(Math.PI/2)).multiply(new Matrix4().makeTranslation(...axis.pivot.map(x=>-x)));
  [leaf,handle].forEach((o,i)=>{const expected=transform.clone().multiply(original[i]);o.matrixWorld.elements.forEach((v,j)=>assert.ok(Math.abs(v-expected.elements[j])<1e-10));});
  group.matrix.copy(local);root.updateMatrixWorld(true);
  const reopened=await new ObjectLoader().parseAsync(JSON.parse(JSON.stringify(root.toJSON())));
  const restored=reopened.getObjectByProperty('uuid',group.uuid);
  assert.equal(restored.userData.calipoDoor,true);assert.equal(restored.children.length,2);
  reopened.updateMatrixWorld(true);
  restored.children.forEach((o,i)=>o.matrixWorld.elements.forEach((v,j)=>assert.ok(Math.abs(v-original[i].elements[j])<1e-10)));
});

test('Seleccionar padre e hijo no aplica dos veces el movimiento ni rompe la jerarquía',()=>{
  const root=new Group(),parent=new Mesh(new BoxGeometry(1,2,.1)),child=new Mesh(new BoxGeometry(.1,.1,.1));
  root.add(parent);parent.add(child);
  const group=groupDoor(root,[child,parent]);
  assert.equal(group.children.length,1);assert.equal(child.parent,parent);
});
test('El eje queda en el borde inferior de una puerta desplazada',()=>{const m=new Mesh(new BoxGeometry(2,4,.2));m.position.set(3,2,1);const d=proposeAxis(m);assert.deepEqual(d.pivot,[2,0,1]);assert.equal(d.height,4);});
test('El giro mantiene inmóvil la bisagra con un padre transformado',()=>{const parent=new Matrix4().makeRotationY(.4).setPosition(5,2,3);const base=parent.clone().multiply(new Matrix4().makeTranslation(1,0,0));const hinge=new Vector3(0,0,0).applyMatrix4(base);const result=doorMatrix(base,parent,hinge.toArray(),Math.PI/2);const after=new Vector3(0,0,0).applyMatrix4(result).applyMatrix4(parent);assert.ok(after.distanceTo(hinge)<1e-10);const closed=doorMatrix(base,parent,hinge.toArray(),0);const expected=new Matrix4().makeTranslation(1,0,0);closed.elements.forEach((v,i)=>assert.ok(Math.abs(v-expected.elements[i])<1e-10));});
test('Guardar y abrir conserva la pieza, su transformación y el eje asociado',async()=>{const root=new Group();const m=new Mesh(new BoxGeometry(1,2,.1));m.position.set(3,1,2);root.add(m);const d=proposeAxis(m);m.matrixAutoUpdate=false;const saved=JSON.parse(JSON.stringify({model:root.toJSON(),doors:{[m.uuid]:d}}));const restored=await new ObjectLoader().parseAsync(saved.model);const door=restored.getObjectByProperty('uuid',m.uuid);assert.ok(door);assert.deepEqual(door.matrix.elements,m.matrix.elements);assert.deepEqual(saved.doors[door.uuid].pivot,d.pivot);});
