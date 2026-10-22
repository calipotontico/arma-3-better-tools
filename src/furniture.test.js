import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {duplicateFurniture} from './furniture.js';
import {exportModel} from './arma/export-model.js';
import {collectSeats,seatDefaults} from './seats.js';
import {History,cloneScene} from './history.js';
import {selectionObject} from './selection.js';
import {generatedHeader} from './arma/config.js';
import {deleteModelObjects} from './model-tools.js';
function fixture(){
  const root=new THREE.Group(),furniture=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(.5,1,.5),new THREE.MeshStandardMaterial());
  furniture.name='Chair';furniture.userData.polyhaven={id:'chair'};furniture.add(mesh);root.add(furniture);
  mesh.userData.armaSeat=seatDefaults(mesh);return {root,furniture,mesh};
}
const options={id:'proxy_test',label:'Proxies',scale:1,collision:true,roadway:true};
test('furniture duplicates retain shared resources, independent seats, transforms and project undo',()=>{
  let {root,furniture,mesh}=fixture();
  furniture.matrix.makeRotationY(.4).setPosition(3,0,2);furniture.matrixAutoUpdate=false;
  const history=new History(()=>cloneScene(root),v=>root=cloneScene(v));history.record('proxy');
  const copy=duplicateFurniture(root,mesh);
  assert.equal(copy.children[0].geometry,mesh.geometry);assert.equal(copy.children[0].material,mesh.material);
  assert.notEqual(copy.children[0].uuid,mesh.uuid);assert.notEqual(copy.children[0].userData.armaSeat,mesh.userData.armaSeat);
  assert.equal(selectionObject(copy.children[0],root),copy);
  const saved=root.toJSON();assert.equal(saved.geometries.length,1);
  const loaded=new THREE.ObjectLoader().parse(saved);
  assert.equal(collectSeats(loaded).length,2);
  const seats=collectSeats(loaded);assert.ok(seats[0].position.distanceTo(seats[1].position)>.5);
  assert.ok(Math.abs(seats[0].heading-seats[1].heading)<1e-6);
  history.undo();assert.equal(root.children.length,1);assert.equal(root.children[0].userData.armaProxy,undefined);
  history.redo();assert.equal(root.children.length,2);
});
test('export packs one reusable visual for rotated copies and keeps independent seat Memory',()=>{
  const {root,mesh}=fixture();const copy=duplicateFurniture(root,mesh);
  copy.matrix.makeRotationY(Math.PI/2).setPosition(2,0,1);
  const result=exportModel(root,{},options);
  assert.equal(result.proxyModels.length,1);assert.equal(result.stats.proxies,2);
  assert.equal(result.stats.faces,2);assert.equal(result.stats.seats,2);
  const bytes=Buffer.from(result.p3d);
  assert.ok(bytes.includes(Buffer.from('proxy:\\proxy_test\\furniture_1.001')));
  assert.ok(bytes.includes(Buffer.from('proxy:\\proxy_test\\furniture_1.002')));
  assert.ok(bytes.includes(Buffer.from('abt_seat_2_exit')));
  for(const asset of result.assets.filter(a=>a.name.endsWith('.sqf')))assert.ok(asset.text.startsWith(generatedHeader));
});
test('different scales generate separate proxy resources; animated furniture is rejected',()=>{
  const {root,mesh}=fixture();const copy=duplicateFurniture(root,mesh);
  copy.matrix.scale(new THREE.Vector3(2,1,1));
  assert.equal(exportModel(root,{},options).proxyModels.length,2);
  mesh.userData.armaGlass={};
  assert.throws(()=>exportModel(root,{},options));
});
test('duplicate uses current rotation and scale before a render updates the matrix',()=>{
  const {root,furniture,mesh}=fixture();
  furniture.rotation.y=.75;furniture.scale.set(2,1,3);
  const copy=duplicateFurniture(root,mesh);
  const originalAxes=furniture.matrix.elements.slice(0,12);
  assert.deepEqual(copy.matrix.elements.slice(0,12),originalAxes);
});
test('deleting the original preserves the other proxy, its seat and export after reload',()=>{
  const {root,furniture,mesh}=fixture(),copy=duplicateFurniture(root,mesh);
  const exit=[...copy.children[0].userData.armaSeat.exit];
  deleteModelObjects(root,[furniture],{});
  assert.deepEqual(copy.children[0].userData.armaSeat.exit,exit);
  const reloaded=new THREE.ObjectLoader().parse(root.toJSON()),result=exportModel(reloaded,{},options);
  assert.equal(result.stats.proxies,1);assert.equal(result.stats.seats,1);
  assert.equal(result.proxyModels.length,1);assert.equal(result.proxyModels[0].faces,12);
});
