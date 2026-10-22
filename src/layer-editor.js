import {ladderMeshes} from './ladders.js';
import {seatMeshes} from './seats.js';
import {syncDoorSwitch} from './door-motion.js';
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { modelMeshes, shapesFor, setShapes, defaultShape, shapeGeometry, automaticRoadway, splitShape, rectangularOpening, validateShape, validateMemory } from './layers.js';
import { doorOwner } from './selection.js';
import { readLights, moveLightPoint } from './lighting-data.js';

export function installLayerEditor(api){
  const panel=document.createElement('section');panel.id='layerPanel';
  panel.innerHTML=`<div class="section-title">CAPAS DEL EDIFICIO</div><label for="layerMode">Editar capa</label><select id="layerMode"><option value="visual">Modelo y puertas</option><option value="geometry">Colisión</option><option value="fire">Disparos</option><option value="view">Visión IA</option><option value="roadway">Suelos</option><option value="memory">Puntos Memory</option><option value="shadow">Sombras</option></select><div id="layerTools" hidden>
  <p class="hint" id="layerHint"></p><label for="layerSource">Pieza de referencia</label><select id="layerSource"></select><label for="layerItem">Elemento de la capa</label><select id="layerItem" size="6"></select>
  <button id="layerAdd">Añadir</button><button id="layerRemove">Eliminar elemento</button><button id="layerDuplicate">Duplicar</button>
  <fieldset id="layerFields"><label for="layerName">Nombre</label><input id="layerName" maxlength="63"><label>Posición X / Y / Z <small id="layerCoordinates">coordenadas locales de la pieza</small></label><div class="coordinates">${['X','Y','Z'].map(a=>`<input id="layerP${a}" aria-label="Posición ${a}" type="number" step="0.01">`).join('')}</div>
  <div id="layerDimensions"><label>Tamaño X / Y / Z</label><div class="coordinates">${['X','Y','Z'].map(a=>`<input id="layerS${a}" aria-label="Tamaño ${a}" type="number" step="0.01" min="0">`).join('')}</div><label>Giro local en grados X / Y / Z</label><div class="coordinates">${['X','Y','Z'].map(a=>`<input id="layerR${a}" aria-label="Giro ${a}" type="number" step="1">`).join('')}</div></div><button id="layerApply">Aplicar cambios</button></fieldset>
  <div id="layerBoxTools"><label>Dividir caja</label><div class="layer-actions">${['x','y','z'].map(a=>`<button data-split="${a}">Dividir ${a.toUpperCase()}</button>`).join('')}</div><label>Hueco en el plano X/Y local</label><div class="coordinates"><input id="holeWidth" aria-label="Ancho del hueco" type="number" min="0.01" step="0.1" value="1"><input id="holeHeight" aria-label="Alto del hueco" type="number" min="0.01" step="0.1" value="2"></div><label><input id="holeDoor" type="checkbox" checked> Desde abajo (puerta)</label><button id="layerHole">Crear hueco en esta caja</button><button id="layerCopy">Copiar esta pieza a colisión, disparos y visión</button></div>
  <button id="layerAuto">Restaurar automático en esta pieza</button><p class="hint">Arrastra el gizmo para mover. Ctrl + Z deshace. Los cambios se guardan y se exportan. Las capas se corrigen por separado.</p></div>`;
  document.querySelector('.properties').prepend(panel);
  const $=id=>document.getElementById(id),overlay=new THREE.Group(),proxy=new THREE.Object3D();api.scene.add(overlay,proxy);
  const gizmo=new TransformControls(api.camera,api.canvas);api.scene.add(gizmo.getHelper());gizmo.setMode('translate');
  const ladderPaths=new Map();
  function updateLadderPath(owner){const line=ladderPaths.get(owner.uuid);if(!line)return;const points=['start','end'].map(k=>owner.localToWorld(new THREE.Vector3(...owner.userData.armaLadder[k])));line.geometry.setFromPoints(points);line.geometry.computeBoundingSphere();line.material.color.set(Math.hypot(points[1].x-points[0].x,points[1].z-points[0].z)>.05?0xff6555:0x76e096);}
  let mode='visual',entries=[],current=null,dragging=false,suppress=false,face=null,dragShape=null;
  const faceMode=()=>document.getElementById('componentMode')?.value==='faces';
  const rotation=s=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...(s.rotation||[0,0,0]).map(THREE.MathUtils.degToRad)));
  function facePosition(e){const offset=new THREE.Vector3().setComponent(face.axis,face.sign*e.data.size[face.axis]/2).applyQuaternion(rotation(e.data));return new THREE.Vector3(...e.data.center).add(offset).applyMatrix4(e.owner.matrixWorld);}
  const faceHighlight=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xff973d,transparent:true,opacity:.6,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));faceHighlight.visible=false;faceHighlight.renderOrder=10;api.scene.add(faceHighlight);
  const colors={shadow:0xf1cc4d,geometry:0x38c9e8,fire:0xff6b66,view:0xc29aff,roadway:0x76e096,memory:0xffc56a};
  const key=e=>`${e.owner.uuid}:${e.kind||mode}:${e.index}`;
  function clean(){faceHighlight.visible=false;ladderPaths.clear();for(const o of [...overlay.children]){o.traverse(c=>{c.geometry?.dispose();c.material?.dispose();});overlay.remove(o);}gizmo.detach();}
  function source(){return api.root()?.getObjectByProperty('uuid',$('layerSource').value)||modelMeshes(api.root())[0];}
  function change(label,fn){if(!api.root())return;try{api.record(label);fn();rebuild();api.status(label+'. Ctrl + Z lo deshace.');}catch(e){api.status(e.message);}}
  function confirmed(mesh){const owner=doorOwner(mesh,api.root()),d=api.doors()[owner?.uuid]||api.doors()[mesh.uuid];return d&&d.confirmed!==false;}
  const lightPoint=e=>e.kind==='lightPos'||e.kind==='lightSwitch';
  const ladderPoint=e=>e.kind==='ladderStart'||e.kind==='ladderEnd';
  const seatPoint=e=>e.kind==='seatPosition'||e.kind==='seatExit';
  const localPoint=e=>!e.kind||e.kind==='extra'||lightPoint(e)||ladderPoint(e)||seatPoint(e);
  function readPosition(e){
    if(seatPoint(e))return e.owner.userData.armaSeat[e.kind==='seatPosition'?'position':'exit'];
    if(ladderPoint(e))return e.owner.userData.armaLadder[e.kind==='ladderStart'?'start':'end'];
    if(lightPoint(e))return readLights(api.root())[e.index][e.kind==='lightPos'?'position':'switchPosition'];
    if(e.kind==='extra')return e.data.position;
    if(e.kind){const d=api.doors()[e.owner.uuid];if(e.kind==='start')return d.pivot;if(e.kind==='end')return new THREE.Vector3(...d.pivot).addScaledVector(new THREE.Vector3(...d.direction||[0,1,0]),d.height).toArray();return d.trigger||new THREE.Box3().setFromObject(e.owner).getCenter(new THREE.Vector3()).toArray();}
    return e.data.center;
  }
  function setPosition(e,p){
    if(!p.every(Number.isFinite))throw new Error('Coordenadas no válidas.');
    if(seatPoint(e)){e.owner.userData.armaSeat={...e.owner.userData.armaSeat,[e.kind==='seatPosition'?'position':'exit']:p};return;}
    if(ladderPoint(e)){e.owner.userData.armaLadder={...e.owner.userData.armaLadder,[e.kind==='ladderStart'?'start':'end']:p};updateLadderPath(e.owner);return;}
    if(lightPoint(e)){moveLightPoint(api.root(),e.index,e.kind==='lightPos'?'position':'switchPosition',p);return;}
    if(e.kind==='extra'){api.root().userData.armaMemory[e.index].position=p;return;}
    if(e.kind){const d=api.doors()[e.owner.uuid];if(e.kind==='trigger'){d.trigger=p;syncDoorSwitch(api.doors(),e.owner.uuid);return;}const start=e.kind==='start'?p:d.pivot,end=e.kind==='end'?p:readPosition({...e,kind:'end'}),dir=new THREE.Vector3(...end).sub(new THREE.Vector3(...start));if(dir.length()<.0001)throw new Error('Los extremos del eje deben estar separados.');d.pivot=start;d.height=dir.length();d.direction=dir.normalize().toArray();return;}
    const all=structuredClone(shapesFor(e.owner,mode)||[defaultShape(e.owner,true)]);all[e.index].center=p;setShapes(e.owner,mode,all);
  }
  function worldPosition(e){const p=new THREE.Vector3(...readPosition(e));return localPoint(e)?p.applyMatrix4(e.owner.matrixWorld):p;}
  function select(e){faceHighlight.visible=false;current=e;for(const o of overlay.children)if(o.material&&o.userData.entry)o.material.opacity=o.userData.entry===e?.id?.toString()? .65:.25;
    $('layerItem').value=e?.id||'';$('layerFields').disabled=!e;$('layerRemove').disabled=!e||!!e.kind&&e.kind!=='extra';$('layerDuplicate').disabled=!e||!!e.kind&&e.kind!=='extra';
    gizmo.detach();$('layerSY').disabled=mode==='roadway';if(!e)return;
    $('layerSource').value=e.owner.uuid;$('layerName').value=e.data.name||e.label;$('layerName').disabled=!!e.kind&&e.kind!=='extra';
    $('layerCoordinates').textContent=(e.kind==='extra'||lightPoint(e))?'coordenadas locales del modelo':ladderPoint(e)||seatPoint(e)?'coordenadas locales de la pieza':e.kind?'coordenadas del visor':'coordenadas locales de la pieza';
    ['X','Y','Z'].forEach((a,i)=>{$('layerP'+a).value=Number(readPosition(e)[i].toFixed(5));$('layerS'+a).value=e.data.size?.[i]??0;$('layerR'+a).value=e.data.rotation?.[i]??0;});
    const editingFace=face&&faceMode()&&!e.kind;gizmo.setSpace(editingFace?'local':'world');proxy.quaternion.identity();if(editingFace){e.owner.getWorldQuaternion(proxy.quaternion);proxy.quaternion.multiply(rotation(e.data));}gizmo.showX=!editingFace||face.axis===0;gizmo.showY=!editingFace||face.axis===1;gizmo.showZ=!editingFace||face.axis===2;proxy.position.copy(editingFace?facePosition(e):worldPosition(e));proxy.updateMatrixWorld(true);if(editingFace){const indices=[0,1,2].filter(i=>i!==face.axis),u=new THREE.Vector3().setComponent(indices[0],e.data.size[indices[0]]),v=new THREE.Vector3().setComponent(indices[1],e.data.size[indices[1]]);const q=rotation(e.data);u.applyQuaternion(q);v.applyQuaternion(q);const center=new THREE.Vector3(...e.data.center).add(new THREE.Vector3().setComponent(face.axis,face.sign*e.data.size[face.axis]/2).applyQuaternion(q));const matrix=new THREE.Matrix4().makeBasis(u,v,new THREE.Vector3().crossVectors(u,v).normalize());matrix.setPosition(center);faceHighlight.matrixAutoUpdate=false;faceHighlight.matrix.copy(e.owner.matrixWorld).multiply(matrix);faceHighlight.visible=true;}gizmo.attach(proxy);
  }
  function rebuild(){
    const old=current?.id,src=$('layerSource').value;clean();entries=[];current=null;
    const root=api.root(),meshes=modelMeshes(root);root?.updateWorldMatrix(true,true);
    $('layerSource').replaceChildren(...meshes.map(m=>new Option(m.name||'Pieza',m.uuid)));if(meshes.some(m=>m.uuid===src))$('layerSource').value=src;
    $('layerTools').hidden=mode==='visual'||!root;document.body.classList.toggle('editing-layer',mode!=='visual');
    if(mode==='visual'||!root)return;
    function add(e,g){e.id=key(e);entries.push(e);const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:colors[mode],transparent:true,opacity:.25,side:THREE.DoubleSide,depthWrite:false,depthTest:mode!=='memory'}));m.userData.entry=e.id;m.renderOrder=5;overlay.add(m);e.helper=m;if(!e.kind){m.matrixAutoUpdate=false;m.matrix.copy(e.owner.matrixWorld);const edges=new THREE.LineSegments(new THREE.EdgesGeometry(g),new THREE.LineBasicMaterial({color:colors[mode],depthTest:false}));edges.renderOrder=6;m.add(edges);}else m.position.copy(worldPosition(e));}
    if(mode==='memory'){
      const radius=Math.max(.015,new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).length()*.004);
      for(const owner of seatMeshes(root))for(const kind of ['seatPosition','seatExit'])add({owner,kind,index:kind,data:{},label:owner.name+' · '+(kind==='seatPosition'?'Memory A':'Memory B')},new THREE.SphereGeometry(radius,12,8));
      for(const [id,d] of Object.entries(api.doors())){const owner=root.getObjectByProperty('uuid',id);if(!owner||d.confirmed===false)continue;for(const kind of ['start','end','trigger'])add({owner,kind,index:kind,data:{},label:`${owner.name||'Puerta'} · ${kind==='start'?'inicio eje':kind==='end'?'fin eje':'interacción'}`},new THREE.SphereGeometry(radius,12,8));}
      for(const owner of ladderMeshes(root)){for(const kind of ['ladderStart','ladderEnd'])add({owner,kind,index:kind,data:{},label:owner.name+' · '+(kind==='ladderStart'?'Memory ↓':'Memory ↑')},new THREE.SphereGeometry(radius,12,8));const line=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({depthTest:false,depthWrite:false}));line.renderOrder=6;line.raycast=()=>{};overlay.add(line);ladderPaths.set(owner.uuid,line);updateLadderPath(owner);}
      const switches=new Set();
      readLights(root).forEach((light,index)=>{
        const name=light.name||'Luz '+(index+1);
        if(root.getObjectByProperty('uuid',light.lampId))add({owner:root,kind:'lightPos',index,data:{},label:name+' · emisión de luz'},new THREE.SphereGeometry(radius,12,8));
        if(light.switchId&&!switches.has(light.switchId)&&root.getObjectByProperty('uuid',light.switchId)){
          switches.add(light.switchId);
          const targets=readLights(root).filter(l=>l.switchId===light.switchId).map(l=>l.name||'Luz').join(', ');
          add({owner:root,kind:'lightSwitch',index,data:{},label:'Interruptor · '+targets},new THREE.SphereGeometry(radius,12,8));
        }
      });
      (root.userData.armaMemory||[]).forEach((p,index)=>add({owner:root,kind:'extra',index,data:p,label:p.name},new THREE.SphereGeometry(radius,12,8)));
    }else for(const mesh of meshes){
      let visible=true;for(let p=mesh;p&&p!==root;p=p.parent)if(!p.visible)visible=false;
      if(!visible)continue;if(mode==='roadway'&&confirmed(mesh))continue;
      const shapes=shapesFor(mesh,mode);
      if(shapes===null){const g=automaticRoadway(mesh);if(g.attributes.position.count)add({owner:mesh,index:0,data:defaultShape(mesh,true),automatic:true,label:`${mesh.name||'Pieza'} · suelo automático`},g);else g.dispose();}
      else shapes.forEach((s,index)=>add({owner:mesh,index,data:s,label:`${mesh.name||'Pieza'} · ${s.name||'Componente'} ${index+1}${mesh.userData.armaLayers?.[mode]===undefined?' (automático)':''}`},shapeGeometry(s,mode==='roadway')));
    }
    $('layerItem').replaceChildren(...entries.map(e=>new Option(e.label,e.id)));
    $('layerSource').hidden=mode==='memory';panel.querySelector('label[for="layerSource"]').hidden=mode==='memory';
    $('layerDimensions').hidden=mode==='memory';$('layerBoxTools').hidden=mode==='memory'||mode==='roadway';$('layerAuto').hidden=mode==='memory'||mode==='shadow';$('layerCopy').hidden=mode==='shadow';
    $('layerHint').textContent=mode==='memory'?'Mueve los ejes de puertas, las luces y sus interruptores. Un interruptor compartido mueve el punto de todas sus luces. Los puntos nuevos se exportan como selecciones Memory; no añaden comportamiento por sí solos.':mode==='roadway'?'Verde: superficies transitables. Al editar un suelo automático se sustituye por un rectángulo editable. Usa varios rectángulos para dejar huecos. No se añaden suelos a puertas.':'Las cajas siguen a su pieza y, si pertenece a una puerta, a su animación. Divide, reduce o crea un hueco; revisa también las otras dos capas.';
    select(entries.find(e=>e.id===old)||null);
  }
  $('layerMode').onchange=()=>{api.close();api.clear();api.stopGizmo();face=null;mode=$('layerMode').value;rebuild();};
  window.addEventListener('edit-light-memory',event=>{
    const {index,kind}=event.detail;
    $('layerMode').value='memory';$('layerMode').dispatchEvent(new Event('change'));
    const light=readLights(api.root())[index];
    const entry=entries.find(e=>e.kind===kind&&(e.index===index||(kind==='lightSwitch'&&readLights(api.root())[e.index]?.switchId===light?.switchId)));
    select(entry||null);
    api.status(entry?'Arrastra las flechas para mover '+entry.label+'. Ctrl + Z deshace.':'Asigna primero la pieza de la luz o del interruptor.');
  });
  window.addEventListener('edit-ladder-memory',event=>{
    $('layerMode').value='memory';$('layerMode').dispatchEvent(new Event('change'));
    select(entries.find(e=>e.kind===event.detail.kind&&e.owner.uuid===event.detail.id)||null);
  });
  window.addEventListener('edit-seat-memory',event=>{
    $('layerMode').value='memory';$('layerMode').dispatchEvent(new Event('change'));
    select(entries.find(e=>e.kind===event.detail.kind&&e.owner.uuid===event.detail.id)||null);
  });
  window.addEventListener('edit-door-memory',event=>{
    const id=event.detail.id;$('layerMode').value='memory';$('layerMode').dispatchEvent(new Event('change'));
    select(entries.find(e=>e.kind==='trigger'&&e.owner.uuid===id)||null);
  });
  $('layerItem').onchange=()=>{face=null;select(entries.find(e=>e.id===$('layerItem').value));};
  document.addEventListener('change',e=>{if(e.target.id!=='componentMode')return;face=null;if(mode!=='visual')select(current);});
  $('layerSource').onchange=()=>select(entries.find(e=>e.owner===source())||null);
  $('layerAdd').onclick=()=>change('Añadir elemento',()=>{
    if(mode==='memory'){const root=api.root();root.userData.armaMemory??=[];let i=1;while(root.userData.armaMemory.some(p=>p.name==='point_'+i))i++;root.userData.armaMemory.push({name:'point_'+i,position:root.worldToLocal(new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3())).toArray()});return;}
    const mesh=source();if(!mesh)throw new Error('Selecciona una pieza de referencia.');if(mode==='roadway'&&confirmed(mesh))throw new Error('Usa una pieza fija para el suelo.');setShapes(mesh,mode,[...(shapesFor(mesh,mode)||[]),defaultShape(mesh,mode==='roadway')]);
  });
  $('layerRemove').onclick=()=>{if(current)change('Eliminar elemento',()=>{if(current.kind==='extra')api.root().userData.armaMemory.splice(current.index,1);else{const all=structuredClone(shapesFor(current.owner,mode)||[]);all.splice(current.index,1);setShapes(current.owner,mode,all);}});};
  $('layerDuplicate').onclick=()=>{if(current)change('Duplicar elemento',()=>{if(current.kind==='extra')api.root().userData.armaMemory.push({...structuredClone(current.data),name:current.data.name+'_copy'});else setShapes(current.owner,mode,[...(shapesFor(current.owner,mode)||[]),structuredClone(current.data)]);});};
  $('layerApply').onclick=()=>{
    if(!current)return;const p=['X','Y','Z'].map(a=>$('layerP'+a).valueAsNumber),name=$('layerName').value.trim();
    try{if(!p.every(Number.isFinite))throw new Error('Posición inválida.');if(current.kind==='extra')validateMemory([{name,position:p}]);else if(!current.kind)validateShape({center:p,size:['X','Y','Z'].map(a=>$('layerS'+a).valueAsNumber),rotation:['X','Y','Z'].map(a=>$('layerR'+a).valueAsNumber)},mode==='roadway');}catch(e){api.status(e.message);return;}
    change('Editar elemento',()=>{setPosition(current,p);if(current.kind==='extra')api.root().userData.armaMemory[current.index].name=name;else if(!current.kind){const all=structuredClone(shapesFor(current.owner,mode));all[current.index]={...all[current.index],name,center:p,size:['X','Y','Z'].map(a=>$('layerS'+a).valueAsNumber),rotation:['X','Y','Z'].map(a=>$('layerR'+a).valueAsNumber)};setShapes(current.owner,mode,all);}});
  };
  panel.querySelectorAll('[data-split]').forEach(b=>b.onclick=()=>{if(current&&!current.kind)change('Dividir caja',()=>{const all=structuredClone(shapesFor(current.owner,mode));all.splice(current.index,1,...splitShape(current.data,b.dataset.split));setShapes(current.owner,mode,all);});});
  $('layerHole').onclick=()=>{
    if(!current)return;const w=$('holeWidth').valueAsNumber,h=$('holeHeight').valueAsNumber,s=current.data;
    if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0||w>=s.size[0]||h>=s.size[1]){api.status('El hueco debe ser menor que la caja en X e Y y mayor que cero.');return;}
    change('Abrir hueco en caja',()=>{const parts=rectangularOpening(s,w,h,$('holeDoor').checked);
      const all=structuredClone(shapesFor(current.owner,mode));all.splice(current.index,1,...parts);setShapes(current.owner,mode,all);
    });
  };
  $('layerCopy').onclick=()=>{const mesh=current?.owner||source();if(mesh)change('Copiar geometría de la pieza a las tres capas',()=>{for(const target of ['geometry','fire','view'])setShapes(mesh,target,shapesFor(mesh,mode));});};
  $('layerAuto').onclick=()=>{const mesh=current?.owner||source();if(mesh)change('Restaurar automático',()=>{if(mesh.userData.armaLayers)delete mesh.userData.armaLayers[mode];});};
  gizmo.addEventListener('dragging-changed',e=>{api.controls.enabled=!e.value;});
  gizmo.addEventListener('mouseDown',()=>{api.record(face&&faceMode()?'Mover cara de capa':'Mover elemento de capa');dragShape=current&&!current.kind?structuredClone(current.data):null;dragging=true;suppress=true;});
  gizmo.addEventListener('objectChange',()=>{if(!dragging||!current)return;try{const p=proxy.position.clone();if(localPoint(current))current.owner.worldToLocal(p);if(face&&faceMode()&&dragShape&&!current.kind){const q=rotation(dragShape),offset=p.clone().sub(new THREE.Vector3(...dragShape.center)).applyQuaternion(q.clone().invert());const axis=face.axis,oldSize=dragShape.size[axis],size=Math.max(.001,oldSize/2+face.sign*offset.getComponent(axis)),center=new THREE.Vector3(...dragShape.center).add(new THREE.Vector3().setComponent(axis,face.sign*(size-oldSize)/2).applyQuaternion(q));const next=structuredClone(dragShape);next.center=center.toArray();next.size[axis]=size;const all=structuredClone(shapesFor(current.owner,mode));all[current.index]=next;setShapes(current.owner,mode,all);p.copy(center);}else setPosition(current,p.toArray());['X','Y','Z'].forEach((a,i)=>$('layerP'+a).value=p.getComponent(i).toFixed(5));if(current.kind)current.helper.position.copy(worldPosition(current));else{current.data=shapesFor(current.owner,mode)[current.index];current.helper.geometry.dispose();current.helper.geometry=shapeGeometry(current.data,mode==='roadway');for(const edge of current.helper.children){edge.geometry.dispose();edge.geometry=new THREE.EdgesGeometry(current.helper.geometry);}}}catch(e){api.status(e.message);}});
  gizmo.addEventListener('mouseUp',()=>{dragging=false;rebuild();setTimeout(()=>suppress=false,0);});
  window.addEventListener('keydown',e=>{if(dragging&&(e.ctrlKey||e.metaKey)){e.preventDefault();e.stopImmediatePropagation();}},true);
  return {selectedObjects:()=>current&&!current.kind?[current.owner]:[],rebuild,stopGizmo(){gizmo.detach();},selectPiece(mesh){select(entries.find(e=>e.owner===mesh||mesh.getObjectByProperty('uuid',e.owner.uuid))||null);},active:()=>mode!=='visual',isDragging:()=>dragging||suppress,busy:()=>dragging||suppress||!!gizmo.axis,pick(ray){if(mode==='visual')return false;if(dragging||suppress||gizmo.axis)return true;const hit=ray.intersectObjects(overlay.children,false)[0],entry=entries.find(e=>e.id===hit?.object.userData.entry)||null;face=null;if(entry&&!entry.kind&&!entry.data.vertices&&faceMode()&&hit.face&&mode!=='roadway'){const n=hit.face.normal.clone().applyQuaternion(rotation(entry.data).invert());const values=n.toArray().map(Math.abs),axis=values.indexOf(Math.max(...values));face={axis,sign:Math.sign(n.getComponent(axis))||1};}select(entry);return true;}};
}
