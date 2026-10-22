import * as THREE from 'three';
import {doorOwner} from './selection.js';
import {getLanguage,onLanguage} from './i18n.js';
const text=(es,en)=>getLanguage()==='en'?en:es;
const confirmed=d=>d&&d.confirmed!==false;
export function ladderMeshes(root){const result=[];root?.traverse(m=>{if(m.isMesh&&m.userData.armaLadder)result.push(m);});return result;}
export function collectLadders(root,doors={}){
  root.updateWorldMatrix(true,true);
  return ladderMeshes(root).map((mesh,i)=>{
    const d=mesh.userData.armaLadder;
    for(let p=mesh;p;p=p.parent)if(!p.visible)throw Error(text('La escalera no tiene geometría visible: ','Ladder has no visible geometry: ')+mesh.name);
    if(confirmed(doors[mesh.uuid])||confirmed(doors[doorOwner(mesh,root)?.uuid])||mesh.userData.armaGlass)throw Error(mesh.name+': '+text('La escalera necesita una pieza fija.','The ladder requires a fixed part.'));
    if(![d.start,d.end].every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)))throw Error(text('Escalera: Memory inválido.','Ladder: invalid Memory.'));
    const start=mesh.localToWorld(new THREE.Vector3(...d.start)),end=mesh.localToWorld(new THREE.Vector3(...d.end));
    if(end.y-start.y<.1)throw Error(text('El punto superior de la escalera debe estar más alto.','The top ladder point must be higher.'));
    if(Math.hypot(end.x-start.x,end.z-start.z)<.01)throw Error(text('Escalera sin orientación: desplaza el punto superior hacia la plataforma, no justo encima del inferior.','Ladder has no facing direction: move the top point towards the platform, not directly above the bottom point.'));
    const radius=d.radius??2.5;if(!Number.isFinite(radius)||radius<.5||radius>5)throw Error(text('Distancia de interacción de la escalera inválida (0,5–5 m).','Invalid ladder interaction distance (0.5–5 m).'));
    return {mesh,start,end,radius,name:`abt_ladder_${i+1}`};
  });
}
// Native climbing interpolates the two Memory points; horizontal separation
// defines facing but must remain tiny for an upright ladder.
export function alignLadderVertical(mesh){
  mesh.updateWorldMatrix(true,true);const d=mesh.userData.armaLadder;
  const start=mesh.localToWorld(new THREE.Vector3(...d.start)),end=mesh.localToWorld(new THREE.Vector3(...d.end));
  const direction=new THREE.Vector3(end.x-start.x,0,end.z-start.z);
  if(direction.length()<.0001)throw Error(text('Desplaza primero el punto superior hacia el lado de salida.','Move the top point towards the exit side first.'));
  direction.normalize().multiplyScalar(.02);end.x=start.x+direction.x;end.z=start.z+direction.z;
  mesh.userData.armaLadder={...d,end:mesh.worldToLocal(end).toArray()};
}
export function proposeLadderPoints(mesh){
  mesh.updateWorldMatrix(true,true);
  const box=new THREE.Box3().setFromObject(mesh),center=box.getCenter(new THREE.Vector3());
  mesh.geometry.computeBoundingBox();const size=mesh.geometry.boundingBox.getSize(new THREE.Vector3());
  const direction=new THREE.Vector3(size.x<size.z?1:0,0,size.x<size.z?0:1).transformDirection(mesh.matrixWorld);direction.y=0;
  if(direction.length()<.001)throw Error(text('La escalera debe estar en posición vertical.','The ladder must be upright.'));
  direction.normalize();const start=center.clone().addScaledVector(direction,.5),end=center.clone().addScaledVector(direction,.48);
  start.y=box.min.y;end.y=box.max.y;
  return {start:mesh.worldToLocal(start).toArray(),end:mesh.worldToLocal(end).toArray(),radius:2.5};
}
export function installLadders(api){
  const panel=document.createElement('section');panel.id='ladderPanel';panel.setAttribute('data-no-i18n','');
  document.querySelector('.properties').append(panel);
  const tr=(es,en)=>getLanguage()==='en'?en:es;
  function render(){
    panel.innerHTML=`<h3>${tr('Escaleras de mano','Ladders')}</h3><p>${tr('Selecciona la pieza de una escalera fija. Coloca el punto inferior delante de la escalera y el superior casi en la misma vertical, 2 cm hacia el lado de salida. Una separación mayor inclina la subida. En Memory, la línea muestra la trayectoria: verde casi vertical, roja inclinada. Ajusta la altura superior al suelo de salida, no al extremo de los pasamanos. Debe haber suelo transitable bajo la salida. Comprueba la subida y la salida en Arma.','Select a fixed ladder part. Place the bottom point in front of the ladder and the top point almost directly above it, 2 cm towards the exit. A larger gap tilts the climb. In Memory, the line shows the path: green is nearly vertical, red is tilted. Set the top height to the landing floor, not the handrail tips. The exit needs a walkable floor underneath. Test climbing and the exit in Arma.')}</p><button class="primary" id="createLadder">${tr('Crear escalera en la selección','Create ladder on selection')}</button><select id="ladderList" aria-label="${tr('Escaleras','Ladders')}"></select><button id="ladderRefresh">${tr('Actualizar lista','Refresh list')}</button><button id="ladderStart">${tr('Mover punto inferior','Move bottom point')}</button><button id="ladderEnd">${tr('Mover punto superior','Move top point')}</button><button id="ladderAlign">${tr('Alinear subida vertical','Align vertical climb')}</button><label for="ladderRadius">${tr('Distancia de interacción (m)','Interaction distance (m)')}</label><input id="ladderRadius" type="number" min="0.5" max="5" step="0.1" value="2.5"><button id="ladderSaveRadius">${tr('Aplicar distancia','Apply distance')}</button><button id="ladderRemove">${tr('Quitar escalera','Remove ladder')}</button>`;
    const $=id=>panel.querySelector('#'+id);
    function refresh(){const old=$('ladderList').value;$('ladderList').replaceChildren(...ladderMeshes(api.root()).map(m=>new Option(m.name,m.uuid)));if(ladderMeshes(api.root()).some(m=>m.uuid===old))$('ladderList').value=old;}
    const syncRadius=()=>{$('ladderRadius').value=api.root()?.getObjectByProperty('uuid',$('ladderList').value)?.userData.armaLadder?.radius??2.5;};
    $('ladderAlign').onclick=()=>{const mesh=api.root()?.getObjectByProperty('uuid',$('ladderList').value);if(!mesh)return;try{api.close();api.record(tr('Alinear escalera','Align ladder'));alignLadderVertical(mesh);api.refresh();}catch(e){api.status(e.message);}};
    $('ladderList').onchange=syncRadius;
    $('ladderRefresh').onclick=()=>{refresh();syncRadius();};
    $('ladderSaveRadius').onclick=()=>{const mesh=api.root()?.getObjectByProperty('uuid',$('ladderList').value),radius=$('ladderRadius').valueAsNumber;if(!mesh)return;if(!Number.isFinite(radius)||radius<.5||radius>5){api.status(tr('Introduce una distancia entre 0,5 y 5 m.','Enter a distance between 0.5 and 5 m.'));return;}api.record(tr('Distancia de escalera','Ladder interaction distance'));mesh.userData.armaLadder={...mesh.userData.armaLadder,radius};};
    $('createLadder').onclick=()=>{
      api.close();const selected=api.selection(),mesh=selected[0];
      if(selected.length!==1||!mesh?.isMesh||confirmed(api.doors()[mesh.uuid])||confirmed(api.doors()[doorOwner(mesh,api.root())?.uuid])||mesh.userData.armaGlass){api.status(tr('Selecciona una sola malla fija.','Select one fixed mesh.'));return;}
      if(mesh.userData.armaLadder){refresh();$('ladderList').value=mesh.uuid;return;}
      api.record(tr('Crear escalera','Create ladder'));mesh.updateWorldMatrix(true,true);
      mesh.userData.armaLadder=proposeLadderPoints(mesh);
      refresh();$('ladderList').value=mesh.uuid;api.refresh();
    };
    for(const [id,kind] of [['ladderStart','ladderStart'],['ladderEnd','ladderEnd']])$(id).onclick=()=>{const uuid=$('ladderList').value;if(uuid)window.dispatchEvent(new CustomEvent('edit-ladder-memory',{detail:{id:uuid,kind}}));};
    $('ladderRemove').onclick=()=>{const mesh=api.root()?.getObjectByProperty('uuid',$('ladderList').value);if(mesh){api.record(tr('Quitar escalera','Remove ladder'));delete mesh.userData.armaLadder;refresh();api.refresh();}};
    refresh();
  }
  render();onLanguage(render);
}
