import test from 'node:test';
import assert from 'node:assert/strict';
import {configs} from './config.js';
test('3D interactions use reusable native hold actions anchored to Memory and recheck access during progress',()=>{
 const options={id:'hold_fixture',scale:1};
 const door={angle:90,interactionMode:'marker',allowedSides:['west'],actionOpen:'Abrir',actionClose:'Cerrar'};
 const light={color:'#ffffff',intensity:100,range:4,initialOn:false,switchId:'switch',interactionMode:'marker',allowedSides:['civilian']};
 const result=configs(options,[door],[light]);const script=result.assets.find(a=>a.name==='scripts/interaction.sqf').text;
 assert.match(script,/BIS_fnc_holdActionAdd/);assert.doesNotMatch(script,/Draw3D|inputAction|_building addAction/);
 assert.match(script,/0\.6,6,false,false,true,3,"",_memory/);
 assert.match(script,/private _progressCondition/);assert.match(script,/_caller distance _pos<3/);assert.match(script,/_caller distance _pos>=3/);
 assert.match(script,/side group player in \[west\]/);assert.match(script,/side group player in \[civilian\]/);
 assert.match(script,/door_1_trigger/);assert.match(script,/abt_light_switch/);assert.match(script,/if \(_on isEqualTo _expected\)/);
 assert.match(result.config,/requiredVersion=2.22/);assert.match(configs(options,[{angle:90}]).config,/requiredVersion=2.0/);
});

test('Hold conditions are single expressions when BIS assigns them to _eval',()=>{
 const result=configs({id:'hold_fixture',scale:1},[{angle:90,interactionMode:'marker'}]);
 const script=result.assets.find(a=>a.name==='scripts/interaction.sqf').text;
 for(const name of ['_condition','_progressCondition']){
  const match=script.match(new RegExp('private '+name+'=format \\["([^"\\n]+)"'));
  assert.ok(match,'Missing condition '+name);
  const condition=match[1].replace('%1','0').replace('%2','false');
  // BIS embeds conditionShow after `_eval =`; declarations must live inside call {}.
  const embedded='_target = _originalTarget; _eval = '+condition+'; _eval';
  assert.match(embedded,/_eval = call \{ private _e=/);
  assert.ok(condition.endsWith(' }'));
  let depth=0;for(const char of condition){if(char==='{')depth++;if(char==='}')depth--;if(char===';')assert.ok(depth>0,'Statement leaked outside expression');assert.ok(depth>=0);}assert.equal(depth,0);
 }
});
