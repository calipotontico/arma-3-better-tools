import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial, Matrix4, Vector3, ObjectLoader } from 'three';
import { History, cloneScene } from './history.js';
import { groupDoor, addDoorPieces, detachPiece, ungroupDoor, proposeAxis, doorMatrix } from './door.js';
import { transformObjects, transformAxis, deltaMatrix, editMaterials } from './editing.js';
import { doorOwner, selectionObject } from './selection.js';

test('Editar una manilla mantiene el grupo y no cambia la hoja, el eje o su material compartido',async()=>{
  const root=new Group(),material=new MeshStandardMaterial({color:'red'});
  const leaf=new Mesh(new BoxGeometry(1,2,.1),material),handle=new Mesh(new BoxGeometry(.1,.1,.1),material);
  handle.position.set(.4,1,.1);root.add(leaf,handle);const door=groupDoor(root,[leaf,handle]);
  const config=proposeAxis(door),savedConfig=structuredClone(config),leafWorld=leaf.matrixWorld.clone();
  assert.equal(selectionObject(handle,root),door);assert.equal(selectionObject(handle,root,true),handle);assert.equal(doorOwner(handle,root),door);
  let state={root,config,memberMode:true,selected:handle.uuid};
  const history=new History(()=>({...state,root:cloneScene(state.root),config:structuredClone(state.config)}),snapshot=>{state={...snapshot,root:cloneScene(snapshot.root)};});
  history.record('Ajustar manilla');
  transformObjects([{object:handle,world:handle.matrixWorld.clone()}],new Matrix4().makeTranslation(.2,.3,0));
  editMaterials([handle],m=>m.color.set('blue'));
  assert.equal(handle.parent,door);assert.equal(door.children.length,2);
  assert.deepEqual(leaf.matrixWorld.elements,leafWorld.elements);assert.deepEqual(config,savedConfig);
  assert.equal(leaf.material.color.getHex(),0xff0000);assert.equal(handle.material.color.getHex(),0x0000ff);
  history.undo();assert.equal(state.memberMode,true);assert.equal(state.root.getObjectByProperty('uuid',handle.uuid).material.color.getHex(),0xff0000);
  history.redo();assert.equal(state.root.getObjectByProperty('uuid',handle.uuid).material.color.getHex(),0x0000ff);
  const loaded=await new ObjectLoader().parseAsync(JSON.parse(JSON.stringify(state.root.toJSON())));
  assert.equal(loaded.getObjectByProperty('uuid',handle.uuid).parent.uuid,door.uuid);
});

test('Deshacer/rehacer añadir, quitar y desagrupar recupera UUID, configuración y jerarquía',()=>{
  let root=new Group(),doors={};const leaf=new Mesh(new BoxGeometry(1,2,.1)),handle=new Mesh(new BoxGeometry(.1,.1,.1));root.add(leaf,handle);
  const door=groupDoor(root,[leaf]);const id=door.uuid,hid=handle.uuid;doors[id]={...proposeAxis(door),confirmed:true};
  const history=new History(()=>({root:cloneScene(root),doors:structuredClone(doors)}),s=>{root=cloneScene(s.root);doors=structuredClone(s.doors);});
  const find=id=>root.getObjectByProperty('uuid',id);
  history.record('Añadir');addDoorPieces(root,door,[handle]);
  history.record('Quitar');detachPiece(root,handle);
  history.undo();assert.equal(find(hid).parent.uuid,id);
  history.undo();assert.equal(find(hid).parent,root);
  history.redo();assert.equal(find(hid).parent.uuid,id);
  history.record('Desagrupar');ungroupDoor(root,find(id));delete doors[id];
  assert.equal(find(id),undefined);history.undo();assert.equal(find(hid).parent.uuid,id);assert.equal(doors[id].confirmed,true);
  assert.equal(history.future.length,1);history.record('Otro cambio');assert.equal(history.future.length,0);
});

test('El historial tiene límite y no copia geometrías ni comparte materiales reemplazados',()=>{
  const root=new Group(),mesh=new Mesh(new BoxGeometry(),new MeshStandardMaterial({color:'red'}));root.add(mesh);
  const history=new History(()=>cloneScene(root),()=>{},2);
  history.record('1');history.record('2');history.record('3');assert.equal(history.past.length,2);
  const stored=history.past[0].state.children[0];assert.equal(stored.geometry,mesh.geometry);
  mesh.material=mesh.material.clone();mesh.material.color.set('blue');assert.notEqual(stored.material.color.getHex(),mesh.material.color.getHex());
  assert.equal(stored.uuid,mesh.uuid);
});

test('Los ajustes de objetos y ejes conservan el movimiento alrededor de la bisagra',async()=>{
  const root=new Group();root.scale.set(1.5,1,.7);root.rotation.y=.3;
  const mesh=new Mesh(new BoxGeometry(1,2,.1));mesh.position.set(2,1,0);root.add(mesh);root.updateMatrixWorld(true);
  const original=mesh.matrixWorld.clone(),config=proposeAxis(mesh);
  const delta=deltaMatrix([1,2,3],[.4,.3,.2],[2,2,2],[0,0,0]);
  transformObjects([{object:mesh,world:original}],delta);
  const expected=delta.clone().multiply(original);
  mesh.matrixWorld.elements.forEach((v,i)=>assert.ok(Math.abs(v-expected.elements[i])<1e-10));
  const changed=transformAxis(config,delta);assert.ok(Math.abs(changed.height-config.height*2)<1e-10);
  const hinge=new Vector3().fromArray(changed.pivot);
  const pointInMesh=hinge.clone().applyMatrix4(mesh.matrixWorld.clone().invert());
  const opened=doorMatrix(mesh.matrixWorld,root.matrixWorld,changed.pivot,1,changed.direction);
  assert.ok(pointInMesh.applyMatrix4(opened).applyMatrix4(root.matrixWorld).distanceTo(hinge)<1e-9);
  const loaded=await new ObjectLoader().parseAsync(JSON.parse(JSON.stringify(root.toJSON())));loaded.updateMatrixWorld(true);
  loaded.children[0].matrixWorld.elements.forEach((v,i)=>assert.ok(Math.abs(v-expected.elements[i])<1e-10));
});
