import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import * as T from 'three';
import {installLayerEditor} from './layer-editor.js';
import {shapesFor} from './layers.js';
import {installViewportInput} from './viewport-input.js';
test('moving one collision face changes its boundary and preserves the opposite face and visual model',t=>{
 const dom=new JSDOM('<div class="properties"></div><select id="componentMode"><option>objects</option><option>faces</option></select><canvas></canvas>');const old={document:globalThis.document,window:globalThis.window,Option:globalThis.Option};Object.assign(globalThis,{document:dom.window.document,window:dom.window,Option:dom.window.Option});t.after(()=>{Object.assign(globalThis,old);dom.window.close();});
 const scene=new T.Scene(),root=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(10,10,10));root.add(mesh);scene.add(root);let recorded=0;
 const api=installLayerEditor({scene,camera:new T.PerspectiveCamera(),canvas:document.querySelector('canvas'),controls:{enabled:true},root:()=>root,doors:()=>({}),close(){},clear(){},stopGizmo(){},record(){recorded++;},status(){}});
 const layer=document.getElementById('layerMode');layer.value='geometry';layer.dispatchEvent(new window.Event('change'));document.getElementById('componentMode').value='faces';scene.updateMatrixWorld(true);
 api.pick(new T.Raycaster(new T.Vector3(20,0,0),new T.Vector3(-1,0,0)));const c=scene.children.find(x=>x.controls)?.controls;assert.ok(c.object);assert.equal(c.object.position.x,5);c.dispatchEvent({type:'mouseDown'});c.object.position.x=6;c.dispatchEvent({type:'objectChange'});c.dispatchEvent({type:'mouseUp'});
 const shape=shapesFor(mesh,'geometry')[0];assert.equal(shape.size[0],11);assert.equal(shape.center[0],.5);assert.equal(shape.center[0]-shape.size[0]/2,-5);assert.equal(mesh.geometry.parameters.width,10);assert.equal(recorded,1);assert.equal(layer.value,'geometry');
});
test('Alt camera gesture suspends navigation input without discarding the active tool',async t=>{
 const dom=new JSDOM('<div><canvas></canvas></div><footer class="viewport-footer"></footer>');const old={document:globalThis.document,window:globalThis.window};Object.assign(globalThis,{document:dom.window.document,window:dom.window});t.after(()=>{Object.assign(globalThis,old);dom.window.close();});let stopped=0;const states=[],canvas=document.querySelector('canvas');installViewportInput({canvas,controls:{},navigate:v=>states.push(v),stopGizmo:()=>stopped++,busy:()=>false,dragging:()=>false});canvas.dispatchEvent(new window.MouseEvent('pointerdown',{altKey:true,button:0}));canvas.dispatchEvent(new window.MouseEvent('pointerup',{altKey:true,button:0}));await Promise.resolve();assert.equal(stopped,0);assert.deepEqual(states,[true,false]);
});
