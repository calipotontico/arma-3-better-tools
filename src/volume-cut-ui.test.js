import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import * as T from 'three';
import {installVolumeCut} from './volume-cut-ui.js';
test('cut gizmo changes local volume dimensions, stages again and never moves the model',t=>{
 const dom=new JSDOM('<section id="interiorPanel"></section><canvas></canvas>');const old=globalThis.document;globalThis.document=dom.window.document;t.after(()=>{globalThis.document=old;dom.window.close();});
 const scene=new T.Scene(),root=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(10,10,10));root.add(mesh);scene.add(root);root.rotation.y=.6;root.scale.setScalar(.7);scene.updateMatrixWorld(true);const before=mesh.matrixWorld.clone();
 const ui=installVolumeCut({scene,camera:new T.PerspectiveCamera(),canvas:document.querySelector('canvas'),controls:{enabled:true},root:()=>root,selection:()=>[mesh],doors:()=>({}),stopOthers(){},status(){},close(){},record(){},refresh(){}});
 document.getElementById('cutUse').click();const controls=scene.children.find(x=>x.controls)?.controls;assert.ok(controls?.object);ui.setMode('scale');assert.equal(controls.mode,'scale');controls.dispatchEvent({type:'mouseDown'});assert.ok(document.getElementById('cutApply').disabled);controls.object.scale.set(3,4,5);controls.dispatchEvent({type:'objectChange'});controls.dispatchEvent({type:'mouseUp'});assert.equal(document.getElementById('cut-size-z').valueAsNumber,5);assert.equal(document.getElementById('cutApply').disabled,false);
 ui.setMode('translate');controls.dispatchEvent({type:'mouseDown'});controls.object.position.set(1,2,3);controls.dispatchEvent({type:'objectChange'});controls.dispatchEvent({type:'mouseUp'});assert.equal(document.getElementById('cut-center-y').valueAsNumber,2);scene.updateMatrixWorld(true);assert.deepEqual(mesh.matrixWorld.elements,before.elements);assert.equal(mesh.userData.armaLayers,undefined);ui.setComponent('faces');
 for(const axis of [0,1,2])for(const sign of [-1,1]){
  const center=new T.Vector3(...['x','y','z'].map(a=>document.getElementById('cut-center-'+a).valueAsNumber)),size=new T.Vector3(...['x','y','z'].map(a=>document.getElementById('cut-size-'+a).valueAsNumber));
  const origin=center.clone().add(new T.Vector3().setComponent(axis,sign*30)).applyMatrix4(mesh.matrixWorld),direction=new T.Vector3().setComponent(axis,-sign).transformDirection(mesh.matrixWorld);
  assert.equal(ui.pick(new T.Raycaster(origin,direction)),true);assert.equal(controls.mode,'translate');assert.ok(controls.object);const fixed=center.getComponent(axis)-sign*size.getComponent(axis)/2;
  controls.dispatchEvent({type:'mouseDown'});controls.object.position.setComponent(axis,controls.object.position.getComponent(axis)+sign*.5);controls.dispatchEvent({type:'objectChange'});controls.dispatchEvent({type:'mouseUp'});
  const a=['x','y','z'][axis],c=document.getElementById('cut-center-'+a).valueAsNumber,n=document.getElementById('cut-size-'+a).valueAsNumber;
  assert.ok(Math.abs(n-size.getComponent(axis)-.5)<1e-8);assert.ok(Math.abs(c-sign*n/2-fixed)<1e-8);assert.equal(document.getElementById('cutApply').disabled,false);
 }
 assert.deepEqual(mesh.matrixWorld.elements,before.elements);assert.equal(mesh.userData.armaLayers,undefined);ui.setComponent('objects');ui.setMode('scale');assert.equal(controls.mode,'scale');ui.clear();assert.equal(controls.object,undefined);
 document.getElementById('cutDoor').click();const origin=new T.Vector3(20,0,0).applyMatrix4(mesh.matrixWorld),direction=new T.Vector3(-1,0,0).transformDirection(mesh.matrixWorld);assert.equal(ui.pick(new T.Raycaster(origin,direction)),true);assert.equal(document.getElementById('cutMode').value,'visual');assert.ok(Math.abs(document.getElementById('cut-size-y').valueAsNumber*.7-2.2)<1e-8);assert.ok(Math.abs(document.getElementById('cut-size-z').valueAsNumber*.7-1.1)<1e-8);assert.equal(document.getElementById('cutApply').disabled,false);assert.equal(mesh.userData.armaLayers,undefined);ui.clear();
 document.getElementById('cutWindow').click();assert.equal(ui.pick(new T.Raycaster(origin,direction)),true);assert.ok(Math.abs(document.getElementById('cut-size-y').valueAsNumber*.7-1.2)<1e-8);document.getElementById('cutWindowGlass').checked=true;document.getElementById('cutApply').click();let panes=0,reveals=0;mesh.traverse(m=>{if(m.userData.armaGlass)panes++;if(m.userData.abtInteriorSurface==='reveal')reveals++;});assert.equal(panes,1);assert.equal(reveals,4);
 document.getElementById('cutInterior').click();document.getElementById('cutCreateShell').click();const shell=mesh.children.find(m=>m.userData.abtInterior);assert.equal(shell.children.length,6);assert.equal(shell.children.filter(m=>m.userData.abtInteriorSurface==='floor').length,1);
 
});
