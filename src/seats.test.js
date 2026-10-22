import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,ObjectLoader} from 'three';
import {seatDefaults,collectSeats} from './seats.js';
import {cloneScene,History} from './history.js';
import {exportModel} from './arma/export-model.js';
import {validateAddonAsset} from '../desktop/addon-assets.mjs';
import {seatingConfig} from './arma/seating-config.js';
function fixture(){const root=new Group(),chair=new Mesh(new BoxGeometry(.5,1,.5),new MeshStandardMaterial());chair.name='Chair';root.add(chair);chair.userData.armaSeat=seatDefaults(chair);return {root,chair};}
test('seats follow mesh transforms, save and undo',()=>{
  let {root,chair}=fixture();chair.rotation.y=Math.PI/2;chair.position.set(2,1,3);chair.scale.setScalar(2);
  const before=collectSeats(root)[0];assert.ok(Math.abs(before.heading+90)<.001);
  const history=new History(()=>cloneScene(root),value=>root=cloneScene(value));history.record('seat');
  chair.userData.armaSeat.exit[0]+=1;
  const serialized=new ObjectLoader().parse(root.toJSON());assert.equal(collectSeats(serialized)[0].mesh.userData.armaSeat.exit[0],1);
  history.undo();assert.equal(collectSeats(root)[0].mesh.userData.armaSeat.exit[0],0);
});
test('seat export includes Memory and validated scripts with server reservation and exit cleanup',()=>{
  const {root}=fixture(),p=exportModel(root,{}, {id:'test_seats',label:'Seats',scale:1,collision:true,roadway:true});
  assert.equal(p.stats.seats,1);assert.match(p.config,/class CfgFunctions/);assert.match(p.config,/abtSeats\[\]/);
  const names=new Set();for(const asset of p.assets){validateAddonAsset(asset,names);names.add(asset.name);}
  assert.ok(names.has('scripts/seat_apply.sqf'));
  const request=p.assets.find(a=>a.name==='scripts/seat_request.sqf').text;
  assert.match(request,/if \(!isServer\)/);assert.match(request,/remoteExecutedOwner != owner _u/);
  const apply=p.assets.find(a=>a.name==='scripts/seat_apply.sqf').text;
  assert.doesNotMatch(apply,/_u attachTo/);assert.ok(apply.includes('addMissionEventHandler ["EachFrame"'));assert.equal(apply.match(/removeMissionEventHandler/g).length,2);assert.match(apply,/removeAction/);assert.match(apply,/enableCollisionWith/);
  assert.match(p.config,/head="headDefault"/);assert.match(p.config,/A3_Anims_F_Config_Sdr/);
  assert.match(apply,/_key != 57/);assert.match(apply,/displayRemoveEventHandler/);
  assert.match(apply,/switchMove "AmovPercMstpSnonWnonDnon"/);
  assert.match(apply,/private _oldFreeLook = enableFreeLook true/);
  assert.equal(apply.match(/enableFreeLook _oldFreeLook/g).length,2);
  assert.equal(apply.match(/hintSilent ""/g).length,2);
  assert.match(apply,/hintSilent \(localize "STR_test_seats_SEAT_HINT"\)/);
  assert.match(p.config,/requiredVersion=2.22/);
  assert.ok(names.has('stringtable.xml'));
  assert.ok(Buffer.from(p.p3d).includes(Buffer.from('abt_seat_1_exit')));
});
test('seat default actions localize in either project language while custom labels stay intact',()=>{
  for(const [sit,stand] of [['Sentarse','Levantarse'],['Sit','Stand up']]){
    const cfg=seatingConfig('test',[{name:'seat',heading:0,radius:2,sit,stand}]);
    assert.match(cfg.property,/\$STR_test_SEAT_SIT/);
    assert.match(cfg.property,/\$STR_test_SEAT_STAND/);
    const xml=cfg.assets.find(a=>a.name==='stringtable.xml').text;
    assert.match(xml,/<English>Stand up<\/English>/);
    assert.match(xml,/<Spanish>Levantarse<\/Spanish>/);
  }
  const cfg=seatingConfig('test',[{name:'seat',heading:0,radius:2,sit:'Use throne',stand:'Leave throne'}]);
  assert.match(cfg.property,/"Use throne","Leave throne"/);
  assert.equal(seatingConfig('test',[]).assets.length,0);
});
test('seats reject moving pieces and unsafe points without rejecting selection placeholders',()=>{
  const {root,chair}=fixture();assert.equal(collectSeats(root,{[chair.uuid]:{confirmed:false}}).length,1);
  assert.throws(()=>collectSeats(root,{[chair.uuid]:{confirmed:true}}));
  chair.userData.armaSeat.exit=[...chair.userData.armaSeat.position];assert.throws(()=>collectSeats(root));
});
