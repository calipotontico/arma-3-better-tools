import test from 'node:test';import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,ObjectLoader,Texture} from 'three';
import {copySettings} from './copy-settings.js';import {readLights,writeLights} from './lighting-data.js';import {reviewModel} from './arma/preflight.js';import {History,cloneScene} from './history.js';
test('Copy settings preserves identities, positions, permissions and shared switches, with undo and save',()=>{
 let root=new Group();const a=new Mesh(new BoxGeometry()),b=new Mesh(new BoxGeometry());root.add(a,b);
 let doors={[a.uuid]:{motion:'translation',slide:[2,0,0],angle:90,pivot:[0,0,0]},[b.uuid]:{pivot:[9,0,0],name:'door_2',switchId:'switch',allowedSides:['west']}};
 const h=new History(()=>({root:cloneScene(root),doors:structuredClone(doors)}),s=>{root=s.root;doors=s.doors;});h.record('copy');
 assert.equal(copySettings(root,doors,'doors',a.uuid,[b.uuid]),1);assert.deepEqual(doors[b.uuid].slide,[2,0,0]);assert.deepEqual(doors[b.uuid].pivot,[9,0,0]);assert.equal(doors[b.uuid].switchId,'switch');assert.deepEqual(doors[b.uuid].allowedSides,['west']);
 h.undo();assert.equal(doors[b.uuid].slide,undefined);h.redo();assert.deepEqual(doors[b.uuid].slide,[2,0,0]);
 writeLights(root,[{name:'a',color:'#ff0000',range:8,intensity:100},{name:'b',switchId:'shared',position:[1,2,3],initialOn:true,range:2}]);copySettings(root,doors,'lights','0',['1']);assert.equal(readLights(root)[1].name,'b');assert.equal(readLights(root)[1].initialOn,true);assert.deepEqual(readLights(root)[1].position,[1,2,3]);assert.equal(readLights(root)[1].range,8);
 root.children[0].userData.armaGlass={opacity:.2,resistance:.1};root.children[1].userData.armaGlass={opacity:.8,resistance:2};copySettings(root,doors,'glass',a.uuid,[b.uuid]);assert.equal(root.children[1].userData.armaGlass.opacity,.2);assert.equal(new ObjectLoader().parse(root.toJSON()).children[1].userData.armaGlass.resistance,.1);
});
test('Preflight distinguishes automatic collision warnings from invalid texture and Memory errors',()=>{
 const root=new Group(),m=new Mesh(new BoxGeometry(),new MeshStandardMaterial());root.add(m);m.name='wall';
 assert.ok(reviewModel(root,{}, {collision:true},'en').some(i=>i.level==='warning'&&i.message.includes('Automatic collision')));
 m.material.map=new Texture();root.userData.armaMemory=[{name:'bad point',position:[0,0,0]}];const results=reviewModel(root,{}, {collision:true},'en');assert.ok(results.some(i=>i.level==='error'&&i.object==='Memory'));assert.ok(results.some(i=>i.level==='error'&&i.object==='wall'));
});
