import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import{applyCatalogTexture}from './texture-search.js';
test('Downloaded texture replaces imported material references and survives project serialization',()=>{
 const old=new T.MeshStandardMaterial({userData:{armaLibrary:{id:'old'}}}),m=new T.Mesh(new T.BoxGeometry(),[old,old]);const texture=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);
 const payload={id:'concrete',resolution:'1k',source:'https://polyhaven.com/a/concrete'};applyCatalogTexture([m],payload,texture);
 assert.equal(m.material[0].map,texture);assert.equal(m.material[0].userData.armaLibrary,undefined);assert.equal(old.map,null);assert.equal(m.material[0].userData.polyhavenTexture.license,'CC0');
 const parsed=new T.ObjectLoader().parse(m.toJSON());assert.equal(parsed.material[0].userData.polyhavenTexture.id,'concrete');
});

