import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAddonAsset} from './addon-assets.mjs';
import {configs} from '../src/arma/config.js';
import {packPbo,readPbo} from './pbo.mjs';
test('Generated door/light marker and glass resources pass desktop validation and enter PBO',()=>{
 for(const mode of ['marker','wheel']){
 const cfg=configs({id:'test_building',scale:1},[{angle:90,interactionMode:mode}], [{color:'#ffffff',intensity:100,range:4,initialOn:false,switchId:'switch',interactionMode:mode}], [{id:1,resistance:.001,minimalHit:0,explosion:1,bulletproof:true}]);
 const seen=new Set();for(const asset of cfg.assets){validateAddonAsset(asset,seen);seen.add(asset.name);}
 const pbo=readPbo(packPbo('test_building',cfg.assets.map(a=>({name:a.name.replaceAll('/','\\'),data:Buffer.from(a.text)}))));
 assert.equal(pbo.files.length,cfg.assets.length);
 assert.equal(seen.has('scripts/interaction.sqf'),mode==='marker');
 }
});
test('Asset validation still rejects traversal, unknown files, duplicate and oversized scripts',()=>{
 for(const name of ['../scripts/interaction.sqf','scripts/unknown.sqf','C:/interaction.sqf'])assert.throws(()=>validateAddonAsset({name,text:''},new Set()),/inválido/);
 assert.throws(()=>validateAddonAsset({name:'scripts/interaction.sqf',text:''},new Set(['scripts/interaction.sqf'])),/duplicado/);
 assert.throws(()=>validateAddonAsset({name:'scripts/interaction.sqf',text:'x'.repeat(50001)},new Set()),/Contenido/);
});
