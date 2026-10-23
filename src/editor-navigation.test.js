import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import * as T from 'three';
import {installSubobjects} from './subobjects.js';
import {installUnifiedToolbar} from './unified-toolbar.js';
test('Selection round trip retains faces through points and objects; shortcuts do not steal text input or switch inspector tabs',()=>{
 const dom=new JSDOM('<body><aside class="properties"></aside><select id="layerMode"><option value="visual">Visual</option></select><div id="editToolbar"><button data-mode="select"></button><button data-mode="translate"></button><button data-mode="rotate"></button><button data-mode="scale"></button></div><input id="typing"><button id="tab-objects"></button></body>');
 for(const key of ['window','document','MutationObserver','Event'])globalThis[key]=dom.window[key];
 const root=new T.Group(),mesh=new T.Mesh(new T.PlaneGeometry(),new T.MeshBasicMaterial());root.add(mesh);const scene=new T.Scene();scene.add(root);let chosen=[mesh],tabChanges=0,transform='';
 const controls={enabled:true};const canvas=document.createElement('canvas');const camera=new T.PerspectiveCamera();
 const sub=installSubobjects({scene,camera,controls,canvas,root:()=>root,selection:()=>chosen,selectObjects:v=>chosen=v,clear:()=>chosen=[],stop(){},close(){},record(){},status(){}});
 sub.setMode('faces');assert.equal(sub.selectedFaces()[0].faces.size,2);
 sub.click(new T.Raycaster(new T.Vector3(.3,.1,1),new T.Vector3(0,0,-1)),{},{});assert.equal(sub.selectedFaces()[0].faces.size,1);
 sub.setMode('points');assert.equal(sub.selectedObjects()[0],mesh);sub.setMode('faces');assert.equal(sub.selectedFaces()[0].faces.size,1);sub.setMode('objects');assert.deepEqual(chosen,[mesh]);sub.setMode('faces');assert.equal(sub.selectedFaces()[0].faces.size,1);
 document.getElementById('tab-objects').onclick=()=>tabChanges++;
 const editor={setMode:m=>transform=m,isDragging:()=>false};const layerEditor={active:()=>false,isDragging:()=>false};
 installUnifiedToolbar({editor,subEditor:sub,layerEditor});
 document.querySelector('[data-component="objects"]').click();assert.equal(tabChanges,0);assert.deepEqual(chosen,[mesh]);
 for(const [key,mode] of [['1','translate'],['2','rotate'],['3','scale']]){document.body.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,bubbles:true}));assert.equal(transform,mode);}
 document.getElementById('typing').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'1',bubbles:true}));assert.equal(transform,'scale');
 dom.window.close();
});
