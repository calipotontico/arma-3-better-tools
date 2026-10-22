import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {spotDirection,spotCone,updateSpotCone,validateSpot} from './spotlight.js';
import {lightDefaults,writeLights} from './lighting-data.js';
import {exportModel} from './arma/export-model.js';
import {validateAddonAsset} from '../desktop/addon-assets.mjs';
test('Spot cone tip, direction, angle and length agree without changing model geometry',()=>{
  const d={type:'spot',spotHeading:90,spotTilt:0,spotAngle:60};validateSpot(d);
  const direction=spotDirection(d);assert.ok(direction.distanceTo(new THREE.Vector3(1,0,0))<1e-8);
  const cone=spotCone();updateSpotCone(cone,new THREE.Vector3(2,3,4),direction,8,60);cone.updateMatrixWorld(true);
  assert.ok(cone.localToWorld(new THREE.Vector3(0,0,0)).distanceTo(new THREE.Vector3(2,3,4))<1e-8);
  assert.ok(cone.localToWorld(new THREE.Vector3(0,-1,0)).distanceTo(new THREE.Vector3(10,3,4))<1e-8);
  assert.ok(Math.abs(cone.scale.x-8*Math.tan(Math.PI/6))<1e-8);
  assert.throws(()=>validateSpot({...d,spotAngle:180}));
});
test('Mixed point and spot lights retain state sharing and export distinct Memory directions',()=>{
  const root=new THREE.Group(),pieces=Array.from({length:3},()=>new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),new THREE.MeshStandardMaterial()));root.add(...pieces);
  const light={...lightDefaults(),lampId:pieces[0].uuid,switchId:pieces[2].uuid,type:'spot',spotHeading:0,spotTilt:-90,spotAngle:60};
  writeLights(root,[light,{...light,lampId:pieces[1].uuid}]);
  const result=exportModel(root,{}, {id:'test_spots',label:'Spotlights',scale:1,collision:true,roadway:true});
  const script=result.assets.find(a=>a.name==='scripts/light.sqf').text;
  assert.match(script,/#lightreflector/);assert.match(script,/setLightConePars \[60,30,1\]/);
  assert.match(script,/abt_light_dir_2/);assert.match(script,/setVectorDirAndUp/);
  const names=new Set();for(const a of result.assets){validateAddonAsset(a,names);names.add(a.name);}
  writeLights(root,[{...light,type:'point'}]);
  const point=exportModel(root,{}, {id:'test_points',label:'Point',scale:1,collision:true,roadway:true});
  assert.match(point.assets.find(a=>a.name==='scripts/light.sqf').text,/#lightpoint/);
  assert.doesNotMatch(point.assets.find(a=>a.name==='scripts/light.sqf').text,/setLightConePars/);
  assert.equal(root.children.length,3);
});
