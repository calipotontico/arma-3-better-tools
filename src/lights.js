import { readLights, writeLights, lightDefaults, syncSwitch } from './lighting-data.js';
import {nextName} from './automatic-names.js';
import {interactionFields} from './interaction.js';
import {getLanguage,onLanguage} from './i18n.js';
import {spotDirection,validateSpot,spotCone,updateSpotCone} from './spotlight.js';
import * as THREE from 'three';
import { doorOwner } from './selection.js';

export function validateLight(root,data,doors={}){
  if(!data)return null;
  validateSpot(data);
  for(const id of [data.lampId,data.switchId]){
    const mesh=root.getObjectByProperty('uuid',id);
    if(!mesh?.isMesh)throw new Error('La lámpara o el interruptor ya no existen. Vuelve a asignarlos.');
    if(doorOwner(mesh,root)||(doors[id]&&doors[id].confirmed!==false))throw new Error('Las luces requieren lámpara e interruptor fijos, fuera de las puertas.');
    for(let p=mesh;p;p=p.parent)if(!p.visible)throw new Error('La lámpara y el interruptor deben estar visibles.');
  }
  if(!/^#[0-9a-f]{6}$/i.test(data.color)||!Number.isFinite(data.intensity)||data.intensity<0||data.intensity>100000||!Number.isFinite(data.range)||data.range<=0||data.range>100)throw new Error('Color, intensidad o alcance de luz inválidos.');
  for(const point of [data.position,data.switchPosition])if(!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite))throw new Error('Posición de luz o interruptor inválida.');
  return data;
}
export function objectCenter(root,object){root.updateWorldMatrix(true,true);return root.worldToLocal(new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3())).toArray();}

export function installLights(api){
  const panel=document.createElement('section');panel.innerHTML=`<div class="section-title">LUZ E INTERRUPTOR</div><p id="lampName" class="hint"></p><button id="assignLamp">Usar pieza seleccionada como lámpara</button><p id="switchName" class="hint"></p><button id="assignSwitch">Usar pieza seleccionada como interruptor</button><label for="lampColor">Color</label><input id="lampColor" type="color" value="#fff0ce"><label for="lampIntensity">Intensidad (Arma)</label><input id="lampIntensity" type="number" value="1000" min="0" max="100000"><label for="lampRange">Alcance (m)</label><input id="lampRange" type="number" value="8" min="0.1" max="100" step="0.1"><label><input id="lampInitial" type="checkbox"> Empieza encendida</label><label for="lampOnText">Texto de la rueda: encender</label><input id="lampOnText" maxlength="100" value="Encender luz"><label for="lampOffText">Texto de la rueda: apagar</label><input id="lampOffText" maxlength="100" value="Apagar luz">${[['lampPoint','Posición de la luz'],['switchPoint','Punto de interacción']].map(([id,label])=>`<label>${label} · X / Y / Z en metros del visor</label><div class="coordinates">${['X','Y','Z'].map(a=>`<input id="${id}${a}" aria-label="${label} ${a}" type="number" step="0.05">`).join('')}</div>`).join('')}<button id="applyLamp">Guardar ajustes de luz</button><button id="testLamp">Probar encender / apagar</button><button id="removeLamp">Eliminar esta luz</button><label><input type="checkbox" id="lampNight">Ambiente oscuro de prueba</label><p class="hint">Varias lámparas fijas, cada una vinculada a un interruptor. Un interruptor puede controlar varias luces. Selecciona una pieza para asignarla. Ajusta la posición para sacar la luz de la carcasa. La vista previa no cambia el estado inicial. Luz puntual sin sombras: puede iluminar a través de paredes en Arma. El brillo se aplica a toda la pieza elegida. Ctrl + Z deshace los cambios.</p>`;
  panel.className='lighting-panel';document.getElementById('layerPanel').append(panel);const $=id=>document.getElementById(id);
  panel.insertAdjacentHTML('afterbegin','<label for="lightList">Luz que estás configurando</label><select id="lightList"></select><button id="newLight">Crear otra luz</button><label for="lightLabel">Nombre de la luz</label><input id="lightLabel" maxlength="80"><label for="lightSwitchList">Interruptor que controla esta luz</label><select id="lightSwitchList"></select><p class="hint">Puedes compartir un interruptor entre varias luces. Selecciona una pieza del modelo y usa el botón de asignar interruptor para crear o cambiar la relación.</p>');
  for(const [anchor,id,label,kind] of [['assignLamp','moveLampMemory','Mover punto de luz en el visor','lightPos'],['assignSwitch','moveSwitchMemory','Mover punto del interruptor en el visor','lightSwitch']]){
    const button=document.createElement('button');button.id=id;button.textContent=label;$(anchor).after(button);
    button.onclick=()=>window.dispatchEvent(new CustomEvent('edit-light-memory',{detail:{index:current,kind}}));
  }
  let current=0,last=null,lastRoot=null,lastSelection=null,lastLights=null;
  const spotSettings=document.createElement('details');spotSettings.dataset.noI18n='';spotSettings.open=true;
  spotSettings.innerHTML='<summary id="spotTitle"></summary><label><span id="spotTypeLabel"></span><select id="lampType"><option value="point"></option><option value="spot"></option></select></label><div id="spotControls"><label><span id="spotAngleLabel"></span><input id="spotAngle" type="number" min="5" max="160" value="60"></label><label><span id="spotHeadingLabel"></span><input id="spotHeading" type="number" step="5" value="0"></label><label><span id="spotTiltLabel"></span><input id="spotTilt" type="number" min="-90" max="90" step="5" value="-90"></label><label><input id="spotPreview" type="checkbox" checked><span id="spotPreviewLabel"></span></label><p id="spotHint" class="hint"></p></div>';
  $('lampColor').previousElementSibling.before(spotSettings);
  const labelSpot=()=>{const en=getLanguage()==='en';for(const [id,es,english] of [['spotTitle','Tipo de luz y dirección','Light type and direction'],['spotTypeLabel','Tipo','Type'],['spotAngleLabel','Apertura del cono (°)','Cone opening (°)'],['spotHeadingLabel','Giro local (°)','Local heading (°)'],['spotTiltLabel','Inclinación (−90° hacia abajo)','Tilt (−90° down)'],['spotPreviewLabel','Mostrar cono de alcance','Show range cone'],['spotHint','Vista orientativa; no representa sombras ni bloqueo por paredes. Pulsa Guardar ajustes de luz para conservar los cambios.','Approximate preview; does not represent shadows or wall occlusion. Click Save light settings to keep changes.']])$(id).textContent=en?english:es;
    $('lampType').options[0].text=en?'Point light':'Luz puntual';$('lampType').options[1].text=en?'Spotlight':'Foco direccional';};
  labelSpot();onLanguage(labelSpot);$('lampType').onchange=()=>{$('spotControls').hidden=$('lampType').value!=='spot';};
  const pool=[],preview=new Map();
  const marker=color=>new THREE.Mesh(new THREE.SphereGeometry(.045,10,8),new THREE.MeshBasicMaterial({color,depthTest:false}));
  const fresh=()=>({...lightDefaults(),name:nextName('light',readLights(api.root()).map(l=>l.name)),actionOn:getLanguage()==='en'?'Turn on light':'Encender luz',actionOff:getLanguage()==='en'?'Turn off light':'Apagar luz'});
  const data=()=>readLights(api.root())[current];
  const interaction=interactionFields(panel,'light',patch=>change('Editar interacción',d=>Object.assign(d,patch)),()=>window.dispatchEvent(new CustomEvent('edit-light-memory',{detail:{index:current,kind:'lightSwitch'}})));
  function sync(){const root=api.root(),all=readLights(root),selection=api.selection()[0];
    if(selection!==lastSelection){lastSelection=selection;let found=all.findIndex(d=>d.lampId===selection?.uuid);if(found<0&&selection&&all[current]?.switchId!==selection.uuid)found=all.findIndex(d=>d.switchId===selection.uuid);if(found>=0)current=found;}
    current=Math.min(current,Math.max(0,all.length-1));const d=data();if(root===lastRoot&&d===last&&all===lastLights)return;
    if(root!==lastRoot||all!==lastLights)preview.clear();lastRoot=root;last=d;lastLights=all;
    $('lightList').replaceChildren(...all.map((d,i)=>new Option(d.name||'Luz '+(i+1),String(i))));$('lightList').value=String(current);$('lightLabel').value=d?.name||'';
    const switches=new Map();for(const entry of all)if(entry.switchId)switches.set(entry.switchId,root.getObjectByProperty('uuid',entry.switchId)?.name||'Interruptor');
    $('lightSwitchList').replaceChildren(new Option('Sin asignar',''),...Array.from(switches,([id,name])=>new Option(name,id)));$('lightSwitchList').value=d?.switchId||'';
    $('lampName').textContent='Lámpara: '+(root?.getObjectByProperty('uuid',d?.lampId)?.name||'sin asignar');$('switchName').textContent='Interruptor: '+(root?.getObjectByProperty('uuid',d?.switchId)?.name||'sin asignar');
    let summary=$('switchTargets');if(!summary){summary=document.createElement('p');summary.id='switchTargets';summary.className='hint';$('switchName').after(summary);}summary.textContent=d?.switchId?'Este interruptor controla: '+all.filter(l=>l.switchId===d.switchId).map((l,i)=>l.name||root.getObjectByProperty('uuid',l.lampId)?.name||'Luz').join(', '):'Asigna un interruptor a esta luz.';
    $('moveLampMemory').disabled=!root?.getObjectByProperty('uuid',d?.lampId);$('moveSwitchMemory').disabled=!root?.getObjectByProperty('uuid',d?.switchId);
    $('lampType').value=d?.type||'point';$('spotAngle').value=d?.spotAngle??60;$('spotHeading').value=d?.spotHeading??0;$('spotTilt').value=d?.spotTilt??-90;$('lampType').onchange();
    interaction.sync(d);if(!d)return;for(const [id,key] of [['lampColor','color'],['lampIntensity','intensity'],['lampRange','range'],['lampOnText','actionOn'],['lampOffText','actionOff']])$(id).value=d[key];$('lampInitial').checked=d.initialOn;
    root.updateWorldMatrix(true,true);for(const [prefix,key] of [['lampPoint','position'],['switchPoint','switchPosition']]){const p=root.localToWorld(new THREE.Vector3(...d[key]));['X','Y','Z'].forEach(a=>$(prefix+a).value=+p[a.toLowerCase()].toFixed(4));}
  }
  function change(label,fn){try{const root=api.root();if(!root)throw Error('Importa un modelo primero.');api.close();const all=structuredClone(readLights(root)),next=fn(structuredClone(data()||fresh()));if(next){all[current]=next;syncSwitch(all,current);}else all.splice(current,1);api.record(label);writeLights(root,all);last=null;sync();api.status(label+'. Ctrl + Z deshace.');}catch(e){api.status(e.message);}}
  $('newLight').onclick=()=>{const root=api.root();if(!root)return;const all=structuredClone(readLights(root));if(all.length>=32){api.status('Máximo de 32 luces.');return;}api.record('Crear luz');all.push(fresh());writeLights(root,all);current=all.length-1;lastSelection=api.selection()[0];last=null;sync();};
  $('lightList').onchange=()=>{current=Number($('lightList').value);last=null;lastSelection=api.selection()[0];sync();};
  $('lightSwitchList').onchange=()=>change('Vincular interruptor',d=>{const id=$('lightSwitchList').value,other=readLights(api.root()).find(l=>l.switchId===id);d.switchId=id;if(other){d.switchPosition=[...other.switchPosition];d.initialOn=other.initialOn;d.actionOn=other.actionOn;d.actionOff=other.actionOff;d.interactionMode=other.interactionMode;d.allowedSides=other.allowedSides?[...other.allowedSides]:undefined;}return d;});
  for(const [button,key,point] of [['assignLamp','lampId','position'],['assignSwitch','switchId','switchPosition']])$(button).onclick=()=>change('Asignar pieza de luz',d=>{
    const selection=api.selection();if(selection.length!==1||!selection[0].isMesh)throw new Error('Selecciona una única pieza del modelo.');const m=selection[0];if(doorOwner(m,api.root())||api.doors()[m.uuid]?.confirmed)throw new Error('Usa una pieza fija que no pertenezca a una puerta.');if(key==='lampId'&&readLights(api.root()).some((l,i)=>i!==current&&l.lampId===m.uuid))throw Error('Esa pieza ya pertenece a otra luz.');if(m.userData.armaGlass)throw Error('Usa una pieza que no sea un cristal.');d[key]=m.uuid;d[point]=objectCenter(api.root(),m);if(key==='switchId'){const other=readLights(api.root()).find(l=>l.switchId===m.uuid);if(other){d.initialOn=other.initialOn;d.actionOn=other.actionOn;d.actionOff=other.actionOff;d.interactionMode=other.interactionMode;d.allowedSides=other.allowedSides?[...other.allowedSides]:undefined;d.switchPosition=[...other.switchPosition];}}return d;
  });
  $('applyLamp').onclick=()=>change('Editar luz e interruptor',d=>{
    d.type=$('lampType').value;d.spotAngle=$('spotAngle').valueAsNumber;d.spotHeading=$('spotHeading').valueAsNumber;d.spotTilt=$('spotTilt').valueAsNumber;
    d.name=$('lightLabel').value.trim()||nextName('light',readLights(api.root()).map(l=>l.name));d.color=$('lampColor').value;d.intensity=$('lampIntensity').valueAsNumber;d.range=$('lampRange').valueAsNumber;d.initialOn=$('lampInitial').checked;d.actionOn=$('lampOnText').value.trim()||(getLanguage()==='en'?'Turn on light':'Encender luz');d.actionOff=$('lampOffText').value.trim()||(getLanguage()==='en'?'Turn off light':'Apagar luz');
    api.root().updateWorldMatrix(true,true);for(const [prefix,key] of [['lampPoint','position'],['switchPoint','switchPosition']])d[key]=api.root().worldToLocal(new THREE.Vector3(...['X','Y','Z'].map(a=>$(prefix+a).valueAsNumber))).toArray();validateLight(api.root(),d,api.doors());return d;
  });
  $('removeLamp').onclick=()=>change('Quitar luz e interruptor',()=>null);
  $('testLamp').onclick=()=>{try{validateLight(api.root(),data(),api.doors());if(!data())throw new Error('Asigna la lámpara y el interruptor primero.');const on=!(preview.get(data().switchId)??data().initialOn);preview.set(data().switchId,on);api.status(on?'Prueba: luces del interruptor encendidas.':'Prueba: luces del interruptor apagadas.');}catch(e){api.status(e.message);}};
  return {render(draw){
    sync();const root=api.root(),all=readLights(root),saved=[],ambient=[];
    while(pool.length>all.length){const e=pool.pop();api.scene.remove(e.light,e.spot,e.spot.target,e.cone,e.lampMarker,e.switchMarker);for(const m of [e.lampMarker,e.switchMarker,e.cone]){m.geometry.dispose();m.material.dispose();}e.materials?.forEach(m=>m.dispose());}
    while(pool.length<all.length){const light=new THREE.PointLight(),spot=new THREE.SpotLight(),cone=spotCone(),lampMarker=marker(0xffdb63),switchMarker=marker(0x54e8dd);api.scene.add(light,spot,spot.target,cone,lampMarker,switchMarker);pool.push({light,spot,cone,lampMarker,switchMarker});}
    try{root?.updateWorldMatrix(true,true);all.forEach((d,i)=>{const entry=pool[i],on=preview.get(d.switchId)??d.initialOn,mesh=root?.getObjectByProperty('uuid',d.lampId);entry.spot.visible=false;entry.cone.visible=false;entry.light.visible=!!mesh&&on;entry.lampMarker.visible=!!mesh&&i===current;entry.switchMarker.visible=!!d.switchId&&i===current;entry.lampMarker.position.copy(root.localToWorld(new THREE.Vector3(...d.position)));entry.switchMarker.position.copy(root.localToWorld(new THREE.Vector3(...d.switchPosition)));if(!mesh)return;
      entry.light.position.copy(root.localToWorld(new THREE.Vector3(...d.position)));entry.light.color.set(d.color);entry.light.intensity=d.intensity/50;entry.light.distance=d.range;entry.light.decay=2;
      const focused=i===current&&spotSettings.checkVisibility();
      const draft=focused?{...d,type:$('lampType').value,spotAngle:$('spotAngle').valueAsNumber,spotHeading:$('spotHeading').valueAsNumber,spotTilt:$('spotTilt').valueAsNumber,range:$('lampRange').valueAsNumber}:d;
      const spot=draft.type==='spot',angle=Number.isFinite(draft.spotAngle)?THREE.MathUtils.clamp(draft.spotAngle,5,160):60;
      const direction=spotDirection({...draft,spotHeading:Number.isFinite(draft.spotHeading)?draft.spotHeading:0,spotTilt:Number.isFinite(draft.spotTilt)?draft.spotTilt:-90}).transformDirection(root.matrixWorld),range=Number.isFinite(draft.range)?THREE.MathUtils.clamp(draft.range,.1,100):8;
      entry.spot.visible=entry.light.visible&&spot;entry.light.visible=entry.light.visible&&!spot;entry.cone.visible=spot&&focused&&$('spotPreview').checked;
      entry.spot.position.copy(entry.light.position);entry.spot.target.position.copy(entry.light.position).add(direction);entry.spot.color.copy(entry.light.color);entry.spot.intensity=entry.light.intensity;entry.spot.distance=range;entry.spot.angle=THREE.MathUtils.degToRad(angle/2);entry.spot.penumbra=.5;entry.spot.decay=2;
      updateSpotCone(entry.cone,entry.light.position,direction,range,angle);
      if(on){const original=mesh.material;if(entry.source!==original||entry.color!==d.color){entry.materials?.forEach(m=>m.dispose());entry.materials=(Array.isArray(original)?original:[original]).map(m=>{const c=m.clone();if(c.emissive){c.emissive.set(d.color);c.emissiveIntensity=2;}return c;});entry.source=original;entry.color=d.color;}saved.push([mesh,original]);mesh.material=Array.isArray(original)?entry.materials:entry.materials[0];}
    });
    if($('lampNight').checked)api.scene.traverse(o=>{if(o.isLight&&!pool.some(e=>e.light===o||e.spot===o)){ambient.push([o,o.intensity]);o.intensity*=.04;}});draw();
    }finally{for(const [mesh,material] of saved)mesh.material=material;for(const [l,intensity] of ambient)l.intensity=intensity;}
  }};
}
