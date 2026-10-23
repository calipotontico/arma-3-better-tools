import test from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,MeshBasicMaterial,Group} from 'three';
import {visibleSurfaceHit} from './selection.js';

test('Picking skips hidden surfaces and invisible material groups',()=>{
 const hidden=new Mesh(undefined,new MeshBasicMaterial()),parent=new Group();parent.visible=false;parent.add(hidden);
 const transparent=new Mesh(undefined,new MeshBasicMaterial({transparent:true,opacity:0}));
 const grouped=new Mesh(undefined,[new MeshBasicMaterial({visible:false}),new MeshBasicMaterial()]);
 const hits=[{object:hidden},{object:transparent},{object:grouped,face:{materialIndex:0}},{object:grouped,face:{materialIndex:1}}];
 assert.equal(visibleSurfaceHit(hits),hits[3]);
 assert.equal(visibleSurfaceHit(hits.slice(0,3)),undefined);
});
