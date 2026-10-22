import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,ObjectLoader,PerspectiveCamera,Vector3} from 'three';
import {configuredElements,renameConfigured,focusElement} from './configured-elements.js';
import {History,cloneScene} from './history.js';
import {readLights,writeLights,lightDefaults} from './lighting-data.js';
test('Names persist and undo without changing shared switch links or custom door actions',async()=>{
  let root=new Group();const pieces=Array.from({length:5},()=>new Mesh(new BoxGeometry()));root.add(...pieces);
  const doors={[pieces[0].uuid]:{confirmed:true,actionOpen:'Entrar'}};pieces[1].userData.armaGlass={};
  writeLights(root,[2,3].map(i=>({...lightDefaults(),lampId:pieces[i].uuid,switchId:pieces[4].uuid})));
  const history=new History(()=>cloneScene(root),r=>{root=cloneScene(r);});
  const entries=[...configuredElements(root,doors,'doors'),...configuredElements(root,doors,'glass'),...configuredElements(root,doors,'lights')];
  assert.equal(entries.filter(e=>e.type==='switch').length,1);
  history.record('Renombrar');entries.forEach((e,i)=>renameConfigured(root,e,'Nombre '+i));
  const saved=await new ObjectLoader().parseAsync(root.toJSON());
  assert.equal(configuredElements(saved,doors,'doors')[0].label,'Nombre 0');
  assert.equal(configuredElements(saved,doors,'glass')[0].label,'Nombre 1');
  assert.deepEqual(configuredElements(saved,doors,'lights').map(e=>e.label),['Nombre 2','Nombre 3','Nombre 4']);
  assert.ok(readLights(saved).every(l=>l.switchId===pieces[4].uuid));assert.equal(doors[pieces[0].uuid].actionOpen,'Entrar');
  history.undo();assert.equal(root.children[0].name,'');history.redo();assert.equal(root.children[0].name,'Nombre 0');
  assert.throws(()=>renameConfigured(root,entries[0],'   '),/nombre/);
});
test('Locate frames transformed objects at narrow aspect ratios without moving the object',()=>{
  const root=new Group(),mesh=new Mesh(new BoxGeometry(2,3,.2));root.add(mesh);root.scale.setScalar(2);root.position.set(20,0,10);mesh.position.set(1,2,3);
  const original=mesh.position.clone(),camera=new PerspectiveCamera(50,.5,.1,1000);camera.position.set(2,2,8);
  const controls={target:new Vector3(),update(){camera.lookAt(this.target);camera.updateMatrixWorld();}};
  focusElement(camera,controls,mesh);assert.deepEqual(mesh.position,original);assert.deepEqual(controls.target,new Vector3(22,4,16));
  for(const x of [-1,1])for(const y of [-1.5,1.5])for(const z of [-.1,.1]){const p=mesh.localToWorld(new Vector3(x,y,z)).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&Math.abs(p.z)<1);}
});
