import test from 'node:test';import assert from 'node:assert/strict';
import {Matrix4,Vector3,Group,Mesh,BoxGeometry} from 'three';
import {slideMatrix,doorGroups,syncDoorSwitch,validateDoorMotion} from './door-motion.js';
import {transformAxis} from './editing.js';
import {configs} from './arma/config.js';
import {exportModel} from './arma/export-model.js';
import {proposeAxis} from './door.js';
import {JSDOM} from 'jsdom';import {installDoorControls} from './door-controls.js';
test('Sliding motion translates in world space and scales its travel without translation bias',()=>{
 const parent=new Matrix4().makeTranslation(10,0,0),base=new Matrix4().makeTranslation(11,2,0);
 assert.deepEqual(new Vector3().setFromMatrixPosition(slideMatrix(base,parent,[2,0,0],.5)).toArray(),[2,2,0]);
 const config={pivot:[0,0,0],height:2,angle:90,motion:'translation',slide:[2,0,0]};
 assert.deepEqual(transformAxis(config,new Matrix4().makeScale(3,3,3).setPosition(9,8,7)).slide,[6,0,0]);assert.throws(()=>validateDoorMotion({...config,slide:[0,0,0]}));validateDoorMotion({});
});
test('Shared door switch exports one control pair driving all sources and independent door motion',()=>{
 const root=new Group(),a=new Mesh(new BoxGeometry()),b=new Mesh(new BoxGeometry()),button=new Mesh(new BoxGeometry(.1,.1,.1));root.add(a,b,button);b.position.x=2;
 const settings={[a.uuid]:{...proposeAxis(a),motion:'translation',slide:[-2,0,0],switchId:button.uuid,trigger:[0,1,1],allowedSides:['west'],interactionMode:'marker'},[b.uuid]:{...proposeAxis(b),switchId:button.uuid}};
 syncDoorSwitch(settings,a.uuid);assert.deepEqual(settings[b.uuid].trigger,[0,1,1]);assert.notEqual(settings[a.uuid].allowedSides,settings[b.uuid].allowedSides);
 const data=exportModel(root,settings,{id:'sliding_test',scale:2});assert.match(data.modelCfg,/type="translation"/);assert.match(data.modelCfg,/offset1=4.00000000/);assert.match(data.modelCfg,/type="rotation"/);
 const script=data.assets.find(a=>a.name==='scripts/interaction.sqf').text;assert.match(script,/BIS_fnc_holdActionAdd/);assert.doesNotMatch(script,/inputAction "DefaultAction"/);assert.match(script,/animateSource \['Door_1_source'/);assert.match(script,/animateSource \['Door_2_source'/);assert.doesNotMatch(script,/"door_2_trigger"/);assert.match(script,/false,false,true,3,"",_memory/);assert.match(script,/side group player in \[west\]/);
 const doors=Object.values(settings).map(d=>({...d,interactionMode:'wheel'}));const wheel=configs({id:'sliding_test',scale:1},doors);assert.equal((wheel.config.match(/class Open_/g)||[]).length,1);assert.match(wheel.config,/Door_2_source',1/);assert.equal(doorGroups(doors).length,1);
});
test('Door controls assign a mesh switch and link members, preserving independent travel',()=>{
 const dom=new JSDOM('<section></section>');globalThis.document=dom.window.document;globalThis.Option=dom.window.Option;
 const root=new Group(),a=new Mesh(new BoxGeometry()),b=new Mesh(new BoxGeometry()),button=new Mesh(new BoxGeometry());a.name='A';b.name='B';button.name='Switch';root.add(a,b,button);
 const doors={[a.uuid]:proposeAxis(a),[b.uuid]:proposeAxis(b)};let snapshots=[];let controls;
 controls=installDoorControls(document.querySelector('section'),{root:()=>root,doors:()=>doors,selected:()=>a,close:()=>{},record:()=>snapshots.push(structuredClone(doors)),refresh:()=>controls.sync(doors[a.uuid]),status:message=>{throw Error(message);}});controls.sync(doors[a.uuid]);
 const motion=document.getElementById('doorMotion');motion.value='translation';motion.onchange();assert.deepEqual(doors[a.uuid].slide,[1,0,0]);
 document.getElementById('doorSwitchObject').value=button.uuid;document.getElementById('doorSwitchAssign').click();
 for(const option of document.getElementById('doorSwitchMembers').options)option.selected=true;document.getElementById('doorSwitchLink').click();assert.equal(doors[b.uuid].switchId,button.uuid);assert.equal(doors[b.uuid].motion,undefined);assert.equal(snapshots.length,3);
 assert.equal(JSON.parse(JSON.stringify(doors))[a.uuid].switchId,button.uuid);assert.equal(snapshots[2][b.uuid].switchId,undefined);
 delete globalThis.document;delete globalThis.Option;
});
