import * as THREE from 'three';
import { transformAxis } from './editing.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

// Store a model-local position, but render the reference outside the scaled model.
export function humanPosition(root){
  root.updateWorldMatrix(true,true);
  const saved=root.userData.armaHumanPosition;
  if(saved)return root.localToWorld(new THREE.Vector3().fromArray(saved));
  const bounds=new THREE.Box3().setFromObject(root);
  return new THREE.Vector3(bounds.min.x-.7,bounds.min.y,bounds.max.z+.35);
}
export function setHumanPosition(root,position){
  if(!position.toArray().every(Number.isFinite))throw new Error('Introduce una posición válida.');
  root.updateWorldMatrix(true,true);
  root.userData.armaHumanPosition=root.worldToLocal(position.clone()).toArray();
}
export function humanBesideDoor(door){
  door.updateWorldMatrix(true,true);
  const bounds=new THREE.Box3().setFromObject(door),size=bounds.getSize(new THREE.Vector3()),p=bounds.getCenter(new THREE.Vector3());
  p.y=bounds.min.y;
  // Choose the long horizontal axis, including doors facing sideways.
  if(size.x>=size.z){p.x=bounds.max.x+.45;p.z=bounds.max.z+.4;}
  else {p.z=bounds.max.z+.45;p.x=bounds.max.x+.4;}
  return p;
}

export function scaleBuilding(root,doors,factor){
  if(!Number.isFinite(factor)||factor<=0||factor>1e6)throw new Error('Introduce un factor de escala positivo.');
  root.updateWorldMatrix(true,true);const delta=new THREE.Matrix4().makeScale(factor,factor,factor),world=root.matrixWorld.clone().premultiply(delta);
  root.matrix.copy(root.parent?root.parent.matrixWorld.clone().invert().multiply(world):world);root.matrixAutoUpdate=false;root.updateMatrixWorld(true);
  for(const [id,d] of Object.entries(doors))doors[id]=transformAxis(d,delta);
  root.userData.armaAppliedScale=(root.userData.armaAppliedScale||1)*factor;
  if(root.userData.armaExport)root.userData.armaExport.scale=1;
}
export function installScaleEditor(api){
  const panel=document.createElement('section');panel.innerHTML=`<label for="buildingScale">Escala real del modelo</label><input id="buildingScale" type="number" step="any" min="0.000001" value="1"><button id="applyBuildingScale">Aplicar escala al visor</button><label for="scaleReferenceDoor">Ajustar usando una puerta</label><select id="scaleReferenceDoor"></select><label for="scaleDoorMeters">Altura deseada de la puerta (m)</label><input id="scaleDoorMeters" type="number" value="2.1" min="0.01" step="0.01"><button id="scaleUsingDoor">Ajustar a esta altura</button><label><input type="checkbox" id="humanReference" checked> Referencia humana de 1,80 m</label><p id="buildingSize" class="hint"></p><p class="hint">Factor total respecto al modelo importado. Cambia el tamaño real en el visor y al exportar. La figura es orientativa y no se exporta. Ctrl + Z deshace.</p>`;
  document.getElementById('layerPanel').prepend(panel);const $=id=>document.getElementById(id);
  const placement=document.createElement('details');
  placement.innerHTML=`<summary>Mover referencia humana</summary><button id="humanByDoor">Colocar junto a la puerta elegida arriba</button><p class="hint">Posición de los pies en metros del visor. Y es la altura. Ajusta X y Z para acercarla a la puerta.</p>${['X','Y','Z'].map(axis=>`<label for="human${axis}">${axis} (m)</label><input id="human${axis}" type="number" step="0.1">`).join('')}<button id="humanApply">Aplicar posición</button><label for="humanStep">Paso de movimiento (m)</label><input id="humanStep" type="number" min="0.001" step="0.1" value="0.1"><div>${['X','Y','Z'].map(axis=>`<button type="button" data-human-axis="${axis}" data-direction="-1">−${axis}</button><button type="button" data-human-axis="${axis}" data-direction="1">+${axis}</button>`).join('')}</div><button id="humanReset">Restablecer posición automática</button><p class="hint">La figura mide siempre 1,80 m. Su posición se guarda con el proyecto. Ctrl + Z deshace los movimientos.</p>`;
  panel.append(placement);
  const moveButton=document.createElement('button');moveButton.id='humanGizmo';moveButton.textContent='Mover figura en el visor';
  placement.before(moveButton);
  const human=new THREE.Group(),material=new THREE.MeshStandardMaterial({color:0xffa052,roughness:.8});
  const box=(size,pos)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.position.set(...pos);human.add(m);};
  box([.38,.55,.22],[0,1.225,0]);box([.14,.85,.16],[-.105,.425,0]);box([.14,.85,.16],[.105,.425,0]);box([.11,.62,.12],[-.26,1.13,0]);box([.11,.62,.12],[.26,1.13,0]);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.15,16,12),material);head.position.y=1.65;human.add(head);api.scene.add(human);human.visible=false;
  const gizmo=new TransformControls(api.camera,api.canvas);gizmo.setMode('translate');gizmo.setSpace('world');api.scene.add(gizmo.getHelper());
  let dragging=false,suppress=false;
  function stopGizmo(){gizmo.detach();moveButton.textContent='Mover figura en el visor';}
  function activate(){
    if(!api.root()){api.status('Importa un modelo primero.');return;}
    api.close();api.stopOthers();api.clear();$('humanReference').checked=true;update();
    gizmo.attach(human);moveButton.textContent='Terminar movimiento de figura';
    api.status('Arrastra las flechas para mover la figura. Ctrl + Z deshace.');
  }
  moveButton.onclick=()=>gizmo.object?stopGizmo():activate();
  gizmo.addEventListener('dragging-changed',e=>{api.controls.enabled=!e.value;});
  gizmo.addEventListener('mouseDown',()=>{api.record('Mover referencia humana');dragging=true;suppress=true;});
  gizmo.addEventListener('objectChange',()=>{
    if(!dragging||!api.root())return;
    setHumanPosition(api.root(),human.position);
    ['X','Y','Z'].forEach(axis=>{$('human'+axis).value=Number(human.position[axis.toLowerCase()].toFixed(4));});
  });
  gizmo.addEventListener('mouseUp',()=>{dragging=false;setTimeout(()=>suppress=false,0);api.status('Figura colocada. Ctrl + Z deshace el movimiento.');});
  window.addEventListener('keydown',e=>{
    if(dragging&&(e.ctrlKey||e.metaKey)){e.preventDefault();e.stopImmediatePropagation();}
    else if(e.key==='Escape')stopGizmo();
  },true);
  function update(){const root=api.root();human.visible=!!root&&$('humanReference').checked;if(!root)return;
    root.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());
    human.position.copy(humanPosition(root));human.updateMatrixWorld(true);
    ['X','Y','Z'].forEach(axis=>{$('human'+axis).value=Number(human.position[axis.toLowerCase()].toFixed(4));});
    $('buildingScale').value=root.userData.armaAppliedScale||1;$('buildingSize').textContent=`Ancho ${size.x.toFixed(2)} m · alto ${size.y.toFixed(2)} m · fondo ${size.z.toFixed(2)} m`;
    const selected=$('scaleReferenceDoor').value;$('scaleReferenceDoor').replaceChildren(new Option('Selecciona una puerta creada',''),...Object.entries(api.doors()).filter(([id,d])=>d.confirmed!==false&&root.getObjectByProperty('uuid',id)).map(([id])=>new Option(root.getObjectByProperty('uuid',id).name||'Puerta',id)));$('scaleReferenceDoor').value=selected;
  }
  function apply(factor){if(!api.root())throw new Error('Importa un modelo primero.');if(!Number.isFinite(factor)||factor<=0||factor>1e6)throw new Error('Escala inválida.');if(Math.abs(factor-1)<1e-12){update();return;}api.close();api.record('Ajustar escala real');api.clear();scaleBuilding(api.root(),api.doors(),factor);api.refresh();update();api.frame();api.status('Escala aplicada al modelo, geometrías y Memory. La exportación usa escala 1.');}
  $('applyBuildingScale').onclick=()=>{try{apply($('buildingScale').valueAsNumber/(api.root()?.userData.armaAppliedScale||1));}catch(e){api.status(e.message);}};
  $('scaleUsingDoor').onclick=()=>{try{api.close();const d=api.root()?.getObjectByProperty('uuid',$('scaleReferenceDoor').value),height=$('scaleDoorMeters').valueAsNumber;if(!d||!Number.isFinite(height)||height<=0)throw new Error('Selecciona una puerta y su altura real.');apply(height/new THREE.Box3().setFromObject(d).getSize(new THREE.Vector3()).y);}catch(e){api.status(e.message);}};
  $('humanReference').onchange=()=>{if(!$('humanReference').checked)stopGizmo();update();api.frame();};
  function move(position){
    const root=api.root();if(!root)throw new Error('Importa un modelo primero.');
    if(!position.toArray().every(Number.isFinite))throw new Error('Introduce una posición válida.');
    api.record('Mover referencia humana');setHumanPosition(root,position);
    $('humanReference').checked=true;update();api.status('Referencia humana colocada. Ctrl + Z deshace.');
  }
  function safely(action){try{action();}catch(e){api.status(e.message);}}
  $('humanApply').onclick=()=>safely(()=>move(new THREE.Vector3(...['X','Y','Z'].map(axis=>$('human'+axis).valueAsNumber))));
  $('humanByDoor').onclick=()=>safely(()=>{
    api.close();const door=api.root()?.getObjectByProperty('uuid',$('scaleReferenceDoor').value);
    if(!door)throw new Error('Elige una puerta en «Ajustar usando una puerta».');
    move(humanBesideDoor(door));
  });
  placement.querySelectorAll('[data-human-axis]').forEach(button=>button.onclick=()=>safely(()=>{
    const step=$('humanStep').valueAsNumber;if(!Number.isFinite(step)||step<=0)throw new Error('Introduce un paso positivo.');
    const p=human.position.clone();p[button.dataset.humanAxis.toLowerCase()]+=step*Number(button.dataset.direction);move(p);
  }));
  $('humanReset').onclick=()=>safely(()=>{
    if(!api.root())throw new Error('Importa un modelo primero.');
    api.record('Restablecer referencia humana');delete api.root().userData.armaHumanPosition;update();
  });
  return {update,apply,stopGizmo,busy:()=>dragging||suppress||!!gizmo.axis,isDragging:()=>dragging||suppress,
    pick(ray){
      if(!human.visible)return false;
      const hit=ray.intersectObject(human,true)[0];if(!hit)return false;
      const blocking=ray.intersectObject(api.root(),true).find(h=>{for(let p=h.object;p;p=p.parent)if(!p.visible)return false;return true;});
      if(blocking&&blocking.distance<hit.distance)return false;
      activate();return true;
    },bounds:()=>human.visible?new THREE.Box3().setFromObject(human):new THREE.Box3()};
}
