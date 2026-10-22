import test from 'node:test';
import assert from 'node:assert/strict';
import {nextName} from './automatic-names.js';
import {sideCondition} from './interaction.js';
import {configs} from './arma/config.js';
import {syncSwitch} from './lighting-data.js';
import {MaterialLibrary} from '../desktop/material-library.mjs';
import {libraryResources} from './material-library.js';
test('Incremental names skip existing numeric suffixes without translating custom names',()=>{
 assert.equal(nextName('door',['door_1','door_3','Reception']),'door_4');
 assert.equal(nextName('glass',['glass_2','glass_1']),'glass_3');
 assert.equal(nextName('light',[]),'light_1');
});
test('Side filters are validated and no selection denies interaction',()=>{
 assert.equal(sideCondition({}),'true');assert.match(sideCondition({allowedSides:[]}),/in \[\]/);
 assert.match(sideCondition({allowedSides:['west','independent']}),/west,independent/);
 assert.throws(()=>sideCondition({allowedSides:['invalid']}));
});
test('Marker export replaces wheel actions and preserves memory selection and permission checks',()=>{
 const cfg=configs({id:'test_building',scale:1},[{angle:90,interactionMode:'marker',allowedSides:['west'],actionOpen:'Open "door"',actionClose:'Close'}],[{color:'#ffffff',intensity:100,range:4,initialOn:false,switchId:'switch',interactionMode:'marker',allowedSides:['civilian']}]);
 assert.doesNotMatch(cfg.config,/class Open_1|class LightOn/);
 assert.match(cfg.config,/interaction.sqf/);
 const script=cfg.assets.find(a=>a.name==='scripts/interaction.sqf').text;
 assert.match(script,/door_1_trigger/);assert.match(script,/abt_light_switch/);
 assert.match(script,/side group player in \[west\]/);assert.match(script,/side group player in \[civilian\]/);
 assert.match(script,/if \(!hasInterface/);assert.match(script,/Open ""door""/);
 const wheel=configs({id:'test_building',scale:1},[{angle:90,allowedSides:['east']}]);
 assert.match(wheel.config,/class Open_1/);assert.match(wheel.config,/side group player in \[east\]/);
});
test('Shared switches synchronize interaction and permissions without aliasing arrays',()=>{
 const a={switchId:'same',switchPosition:[0,1,0],allowedSides:['west'],interactionMode:'marker'},b={switchId:'same'};
 syncSwitch([a,b],0);assert.deepEqual(b.allowedSides,['west']);assert.equal(b.interactionMode,'marker');a.allowedSides.push('east');assert.deepEqual(b.allowedSides,['west']);
});
test('Bundled CC0 library has PAA, RVMAT, preview, provenance and exportable resources',async()=>{
 const lib=new MaterialLibrary('desktop/builtin-catalog','');const entries=await lib.list();assert.ok(entries.length>=2);
 for(const item of entries){const e=await lib.get(item.id);assert.equal(e.license,'CC0-1.0');assert.match(e.source,/^https:\/\/ambientcg.com\/a\//);assert.match(e.preview,/^data:image\/png;base64,/);const resources=libraryResources(e,'test_building');assert.ok(resources.files.length>=2);assert.ok(resources.files.every(f=>f.data.length>0));}
});
