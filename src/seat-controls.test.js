import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {Group,Mesh,BoxGeometry} from 'three';
import {installSeats,seatDefaults} from './seats.js';
import {configuredElements,renameConfigured} from './configured-elements.js';

test('Apply ends adjustment only after valid values; sidebar tracks seats and names',t=>{
  const dom=new JSDOM('<section class="properties"></section>');
  const oldDocument=globalThis.document,oldOption=globalThis.Option;
  globalThis.document=dom.window.document;globalThis.Option=dom.window.Option;
  t.after(()=>{globalThis.document=oldDocument;globalThis.Option=oldOption;dom.window.close();});
  t.mock.method(globalThis,'setInterval',()=>0);
  const root=new Group(),seat=new Mesh(new BoxGeometry());root.add(seat);seat.userData.armaSeat=seatDefaults(seat);
  let finished=0,recorded=0;
  installSeats({root:()=>root,selection:()=>[seat],doors:()=>({}),record:()=>recorded++,refresh(){},status(){},finishAdjustment:()=>finished++});
  document.getElementById('seatRadius').value='8';document.getElementById('seatApply').click();
  assert.equal(finished,0);assert.equal(recorded,0);
  document.getElementById('seatRadius').value='2';document.getElementById('seatApply').click();
  assert.equal(finished,1);assert.equal(recorded,1);
  const entry=configuredElements(root,{},'seats')[0];renameConfigured(root,entry,'Silla principal');
  assert.equal(configuredElements(root,{},'seats')[0].label,'Silla principal');
  document.getElementById('seatRemove').click();assert.equal(configuredElements(root,{},'seats').length,0);
});
