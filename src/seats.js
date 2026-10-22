import * as THREE from 'three';
import {doorOwner} from './selection.js';
import {getLanguage,onLanguage} from './i18n.js';
const tr=(es,en)=>getLanguage()==='en'?en:es;
export function seatMeshes(root){const all=[];root?.traverse(o=>{if(o.isMesh&&o.userData.armaSeat)all.push(o);});return all;}
export function seatDefaults(mesh){
  mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox,c=b.getCenter(new THREE.Vector3());
  return {position:[c.x,b.min.y,c.z],exit:[c.x,b.min.y,b.min.z-.8],heading:0,radius:2,sit:tr('Sentarse','Sit down'),stand:tr('Levantarse','Stand up')};
}
export function collectSeats(root,doors={}){
  root.updateWorldMatrix(true,true);
  return seatMeshes(root).map((mesh,i)=>{
    const d=mesh.userData.armaSeat,door=doors[mesh.uuid]||doors[doorOwner(mesh,root)?.uuid];
    if((door&&door.confirmed!==false)||mesh.userData.armaGlass||mesh.userData.armaLadder)throw Error(tr('El asiento necesita una pieza fija: ','The seat requires a fixed part: ')+mesh.name);
    for(let p=mesh;p;p=p.parent)if(!p.visible)throw Error(tr('Asiento oculto: ','Hidden seat: ')+mesh.name);
    if(![d.position,d.exit].every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite))||!Number.isFinite(d.heading)||!Number.isFinite(d.radius)||d.radius<.5||d.radius>5)throw Error(tr('Ajustes de asiento inválidos: ','Invalid seat settings: ')+mesh.name);
    const position=mesh.localToWorld(new THREE.Vector3(...d.position)),exit=mesh.localToWorld(new THREE.Vector3(...d.exit));
    if(position.distanceTo(exit)<.3)throw Error(tr('Separa la salida al menos 30 cm del asiento.','Place the exit at least 30 cm away from the seat.'));
    const a=THREE.MathUtils.degToRad(d.heading),direction=new THREE.Vector3(Math.sin(a),0,-Math.cos(a)).transformDirection(mesh.matrixWorld);
    if(Math.abs(direction.y)>.1)throw Error(tr('El asiento debe estar nivelado.','The seat must be level.'));
    return {mesh,name:`abt_seat_${i+1}`,position,exit,heading:THREE.MathUtils.radToDeg(Math.atan2(direction.x,-direction.z)),radius:d.radius,sit:d.sit||'Sentarse',stand:d.stand||'Levantarse'};
  });
}
export function installSeats(api){
  let watch=()=>{};
  let selectSeat=()=>{};
  globalThis.window?.addEventListener('select-seat',e=>selectSeat(e.detail));
  setInterval(()=>watch(),150);
  const panel=document.createElement('section');panel.id='seatPanel';panel.setAttribute('data-no-i18n','');document.querySelector('.properties').append(panel);
  function render(){
    panel.innerHTML=`<h3>${tr('Asientos','Seats')}</h3>
<button id="seatCreate" class="primary">${tr('Crear asiento','Create seat')}</button>
<label>${tr('Asiento','Seat')}<select id="seatList" aria-label="${tr('Asientos','Seats')}"></select></label>
<button id="seatRefresh">${tr('Actualizar lista','Refresh list')}</button>
<details open><summary>${tr('Posición y orientación','Position and orientation')}</summary>
<button id="seatPosition">${tr('Mover punto del personaje','Move character point')}</button>
<button id="seatExit">${tr('Mover punto de salida','Move exit point')}</button>
<label>${tr('Orientación local (°)','Local heading (°)')}<input id="seatHeading" type="number" step="5"></label>
</details>
<details><summary>${tr('Interacción','Interaction')}</summary>
<label>${tr('Distancia de interacción (m)','Interaction distance (m)')}<input id="seatRadius" type="number" min=".5" max="5" step=".1"></label>
<label>${tr('Texto para sentarse','Sit action label')}<input id="seatSit" maxlength="80"></label>
<label>${tr('Texto para levantarse','Stand action label')}<input id="seatStand" maxlength="80"></label>
<p>${tr('Los textos predeterminados se adaptan al idioma de Arma. Los textos personalizados se conservan.','Default labels follow the Arma language. Custom labels are preserved.')}</p>
</details>
<button id="seatApply">${tr('Aplicar ajustes','Apply settings')}</button>
<button id="seatRemove">${tr('Quitar asiento','Remove seat')}</button>
<details><summary>${tr('Ayuda','Help')}</summary><p>${tr('Selecciona una pieza fija de la silla y pulsa Crear asiento. Mueve los puntos en el visor: personaje y salida. La salida debe quedar sobre suelo transitable. La orientación 0 mira hacia −Z local. Comprueba la altura en Arma; ESPACIO permite levantarse.','Select a fixed chair part and click Create seat. Move the character and exit points in the viewport. Place the exit on walkable ground. Heading 0 faces local −Z. Check the height in Arma; press SPACE to stand up.')}</p></details>`;

    const $=id=>panel.querySelector('#'+id),current=()=>api.root()?.getObjectByProperty('uuid',$('seatList').value);
    function sync(){const d=current()?.userData.armaSeat;for(const id of ['seatPosition','seatExit','seatApply','seatRemove','seatHeading','seatRadius','seatSit','seatStand'])$(id).disabled=!d;$('seatHeading').value=d?.heading??0;$('seatRadius').value=d?.radius??2;$('seatSit').value=d?.sit||'';$('seatStand').value=d?.stand||'';}
    function refresh(id=$('seatList').value){$('seatList').replaceChildren(...seatMeshes(api.root()).map(m=>new Option(m.name,m.uuid)));if(seatMeshes(api.root()).some(m=>m.uuid===id))$('seatList').value=id;sync();}
    $('seatList').onchange=sync;$('seatRefresh').onclick=()=>refresh();
    selectSeat=id=>refresh(id);
    $('seatCreate').onclick=()=>{const items=api.selection(),m=items[0],d=api.doors()[m?.uuid]||api.doors()[doorOwner(m,api.root())?.uuid];
      if(items.length!==1||!m?.isMesh||(d&&d.confirmed!==false)||m.userData.armaGlass||m.userData.armaLadder){api.status(tr('Selecciona una sola pieza fija.','Select one fixed part.'));return;}
      if(!m.userData.armaSeat){api.record(tr('Crear asiento','Create seat'));m.userData.armaSeat=seatDefaults(m);api.refresh();}refresh(m.uuid);
    };
    for(const [id,kind] of [['seatPosition','seatPosition'],['seatExit','seatExit']])$(id).onclick=()=>window.dispatchEvent(new CustomEvent('edit-seat-memory',{detail:{id:current()?.uuid,kind}}));
    $('seatApply').onclick=()=>{const m=current();if(!m)return;const heading=$('seatHeading').valueAsNumber,radius=$('seatRadius').valueAsNumber;
      if(!Number.isFinite(heading)||!Number.isFinite(radius)||radius<.5||radius>5){api.status(tr('Introduce valores válidos (distancia entre 0,5 y 5 m).','Enter valid values (distance between 0.5 and 5 m).'));return;}
      api.record(tr('Ajustar asiento','Adjust seat'));m.userData.armaSeat={...m.userData.armaSeat,heading,radius,sit:$('seatSit').value.trim()||tr('Sentarse','Sit down'),stand:$('seatStand').value.trim()||tr('Levantarse','Stand up')};api.refresh();api.finishAdjustment?.();api.status(tr('Ajustes del asiento aplicados.','Seat settings applied.'));
    };
    $('seatRemove').onclick=()=>{const m=current();if(!m)return;api.record(tr('Quitar asiento','Remove seat'));delete m.userData.armaSeat;api.refresh();refresh();};
    refresh();
    let previousRoot=api.root(),previousSignature='',previousSelection=null;
    watch=()=>{
      const root=api.root(),items=seatMeshes(root),signature=JSON.stringify(items.map(m=>[m.uuid,m.name,m.userData.armaSeat]));
      const selected=api.selection()[0],selectionChanged=selected!==previousSelection;
      if(root!==previousRoot||signature!==previousSignature){refresh();previousRoot=root;previousSignature=signature;}
      if(selectionChanged&&selected?.userData.armaSeat){$('seatList').value=selected.uuid;sync();}
      previousSelection=selected;
    };
  }
  render();onLanguage(render);
}
