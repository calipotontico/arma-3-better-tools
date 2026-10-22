import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,ObjectLoader} from 'three';
import {applyLibraryMaterial,libraryResources} from './material-library.js';
import {History,cloneScene} from './history.js';
import {exportModel} from './arma/export-model.js';
const id='12345678-1234-1234-1234-123456789abc',tex='a'.repeat(20)+'.paa',mat='b'.repeat(20)+'.rvmat';
const entry={id,name:'Cromado',texture:tex,rvmat:mat,files:[{name:tex,data:btoa('PAA fixture')},{name:mat,data:btoa('class Stage1 { texture="__ABT_MATERIAL__\\'+tex+'"; };')}]};
test('Library applies independently, persists in project and exports dependencies without the library',async()=>{
  let root=new Group();const one=new Mesh(new BoxGeometry()),two=new Mesh(new BoxGeometry(),one.material);root.add(one,two);
  const original=one.material,history=new History(()=>cloneScene(root),r=>{root=cloneScene(r);});history.record('Aplicar');applyLibraryMaterial([one],entry,null);
  assert.equal(two.material,original);assert.equal(one.material.userData.armaLibrary.name,'Cromado');
  root=await new ObjectLoader().parseAsync(root.toJSON());
  const result=exportModel(root,{}, {id:'abt_material',scale:1,collision:true,roadway:true});assert.equal(result.libraryFiles.length,2);
  const resources=libraryResources(entry,'abt_material');assert.ok(atob(resources.files[1].data).includes('abt_material\\data\\library\\'+id));
  assert.ok(Buffer.from(result.p3d).includes(Buffer.from(resources.material)));history.undo();assert.equal(root.children[0].material.userData.armaLibrary,undefined);history.redo();assert.equal(root.children[0].material.userData.armaLibrary.name,'Cromado');
});
test('Library rejects paths outside its resource namespace',()=>{assert.throws(()=>libraryResources({...entry,id:'../escape'},'addon'));assert.throws(()=>libraryResources({...entry,files:[{name:'../../file',data:''}]},'addon'));});
