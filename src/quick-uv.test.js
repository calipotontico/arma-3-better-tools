import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {JSDOM} from 'jsdom';
import {projectMetricUV,installQuickUV} from './quick-uv.js';
import {History,cloneScene} from './history.js';

test('Metric projection aligns neighbouring transformed walls and preserves source geometry',()=>{
 const a=new THREE.Mesh(new THREE.PlaneGeometry(2,3)),b=new THREE.Mesh(new THREE.PlaneGeometry(1,1));b.scale.set(2,3,1);b.position.x=2;
 const original=a.geometry.attributes.uv.array.slice();
 const first=projectMetricUV(a,1,1),second=projectMetricUV(b,1,1);
 function edge(g,x){const p=g.attributes.position,u=g.attributes.uv;const found=[];for(let i=0;i<p.count;i++)if(p.getX(i)===x)found.push(u.getX(i));return found;}
 assert.deepEqual(edge(first,1),edge(second,-.5));assert.deepEqual(a.geometry.attributes.uv.array,original);
 assert.equal(Math.max(...first.attributes.uv.array.filter((_,i)=>i%2===0))-Math.min(...first.attributes.uv.array.filter((_,i)=>i%2===0)),2);
 assert.throws(()=>projectMetricUV(a,0,1));
});
test('Quick texture controls create UVs, undo/redo, persist and keep shared materials untouched',async()=>{
 const dom=new JSDOM('<section><button id="openUV"></button></section>');globalThis.document=dom.window.document;
 let root=new THREE.Group();const map=new THREE.Texture(),material=new THREE.MeshStandardMaterial({map}),a=new THREE.Mesh(new THREE.BoxGeometry(2,3,1),material),b=new THREE.Mesh(new THREE.BoxGeometry(),material);a.geometry.deleteAttribute('uv');root.add(a,b);
 const history=new History(()=>cloneScene(root),r=>{root=cloneScene(r);});let message='';
 installQuickUV(document.querySelector('section'),{selection:()=>[root.children[0]],close:()=>{},record:s=>history.record(s),status:s=>message=s},s=>s);
 document.getElementById('quickUVAuto').click();assert.match(message,/ajustada/);assert.ok(root.children[0].geometry.attributes.uv);assert.equal(root.children[1].material.map.wrapS,THREE.ClampToEdgeWrapping);assert.equal(root.children[0].material.map.wrapS,THREE.RepeatWrapping);
 const values=Array.from(root.children[0].geometry.attributes.uv.array);history.undo();assert.equal(root.children[0].geometry.attributes.uv,undefined);history.redo();assert.deepEqual(Array.from(root.children[0].geometry.attributes.uv.array),values);
 const before=root.children[0].geometry.attributes.uv.getX(0);document.getElementById('quickUVLarger').click();assert.ok(Math.abs(root.children[0].geometry.attributes.uv.getX(0)-((before-.5)/1.25+.5))<1e-6);
 document.getElementById('quickUVRotate').click();assert.equal(history.past.length,3);
 const loaded=new THREE.BufferGeometryLoader().parse(root.children[0].geometry.toJSON());assert.deepEqual(Array.from(loaded.attributes.uv.array),Array.from(root.children[0].geometry.attributes.uv.array));
 delete globalThis.document;
});

