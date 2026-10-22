import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,ObjectLoader} from 'three';
import {setEditorVisible,selectedMeshes,withExportVisibility} from './scene-organization.js';
import {exportModel} from './arma/export-model.js';
import {cloneScene,History} from './history.js';
test('scene visibility survives save and undo without changing exported faces',()=>{
  let root=new Group();const piece=new Mesh(new BoxGeometry(),new MeshStandardMaterial());root.add(piece);
  const options={id:'test_building',label:'Test',author:'Test',scale:1,collision:false,roadway:false};
  const before=exportModel(root,{},options).stats.faces;
  const history=new History(()=>cloneScene(root),state=>root=cloneScene(state));history.record('hide');
  root.userData.abtSceneGroups=[{id:'group',name:'Walls',members:selectedMeshes([piece])}];setEditorVisible(piece,false);
  assert.equal(exportModel(root,{},options).stats.faces,before);assert.equal(piece.visible,false);
  const saved=new ObjectLoader().parse(root.toJSON());assert.equal(saved.children[0].visible,false);
  assert.equal(saved.userData.abtSceneGroups[0].members[0],saved.children[0].uuid);
  history.undo();assert.equal(root.children[0].visible,true);history.redo();assert.equal(root.children[0].visible,false);
  setEditorVisible(root.children[0],true);assert.equal(root.children[0].visible,true);
});
test('export visibility restores editor state on failure and respects original hidden objects',()=>{
  const root=new Group(),piece=new Group();piece.visible=false;root.add(piece);setEditorVisible(piece,false);
  assert.throws(()=>withExportVisibility(root,()=>{assert.equal(piece.visible,false);throw Error('failed');}));
  setEditorVisible(piece,true);assert.equal(piece.visible,false);
});
