import {test} from 'node:test';import assert from 'node:assert/strict';import {ProjectSaveState} from './project-save-state.js';
test('Closing saves once, cancellation/failure retains dirty state and changes during saving remain unsaved',async()=>{
  const state=new ProjectSaveState();state.changed();assert.equal(await state.mayClose(async()=> 'cancel',()=>{throw Error('must not save');}),false);
  assert.equal(await state.save(async()=>false),false);assert.ok(state.dirty);
  let finish,calls=0;const save=()=>state.save(()=>{calls++;return new Promise(resolve=>finish=resolve);});
  const a=save(),b=save();await Promise.resolve();assert.equal(calls,1);state.changed();finish(true);assert.equal(await a,false);assert.equal(await b,false);assert.ok(state.dirty);
  await assert.rejects(state.save(async()=>{throw Error('Disk full');}));assert.ok(state.dirty);
  assert.equal(await state.mayClose(async()=> 'save',()=>state.save(async()=>true)),true);assert.equal(state.dirty,false);
  state.changed();assert.equal(await state.mayClose(async()=> 'discard',()=>false),true);
});
