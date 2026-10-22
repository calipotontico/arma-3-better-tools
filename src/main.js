import {installInteractionPreview} from './interaction-preview.js';
import {installInteriors} from './interiors.js';
import {installExistingInterior} from './existing-interior.js';
import {installVolumeCut} from './volume-cut-ui.js';
import {installCopySettings} from './copy-settings.js';
import {installWorkspaceUI} from './project-workspace.js';
import {deleteModelObjects} from './model-tools.js';
import {installPolyHaven} from './polyhaven.js';
import {installSeats} from './seats.js';
import {duplicateFurniture,validateFurniture,furnitureRoot} from './furniture.js';
import {installPlacement} from './furniture-placement.js';
import {prepareFaceDoor} from './face-door.js';
import {installFaceWindow} from './face-window.js';
import {installLadders} from './ladders.js';
import {installDoorControls} from './door-controls.js';
import {garageMotion} from './garage-door.js';
import {slideMatrix,syncDoorSwitch,validateDoorMotion} from './door-motion.js';
import { installUnifiedToolbar } from './unified-toolbar.js';
import {interactionFields} from './interaction.js';
import { installTutorial } from './tutorial.js';
import { installSceneTree } from './scene-tree.js';
import { installAppSettings } from './app-settings.js';
import { installEditorShell } from './editor-shell.js';
import { t,getLanguage,onLanguage } from './i18n.js';
import { ProjectSaveState } from './project-save-state.js';
import { installMaterialLibrary } from './material-library.js';
import { installContextList } from './context-list.js';
import { renameConfigured, focusElement } from './configured-elements.js';
import { installUVEditor } from './uv-editor.js';
import { installPropertyTabs } from './property-tabs.js';
import { installExportUI } from './arma/export-ui.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { proposeAxis, doorMatrix, groupDoor, detachPiece, ungroupDoor, addDoorPieces } from './door.js';
import './style.css';
import './editor-shell.css';
import { doorOwner, selectionObject } from './selection.js';
import { cloneScene } from './history.js';
import { createEditor } from './editor.js';
import { installLayerEditor } from './layer-editor.js';
import { installSubobjects } from './subobjects.js';
import { installRecalculate } from './recalculate.js';
import { installScaleEditor } from './scale-editor.js';
import { installShadows } from './shadows.js';
import { installLights } from './lights.js';
import { installGlass } from './glass.js';
import { installFaceOrientation } from './face-orientation.js';
import { installViewportInput, meshesInRectangle } from './viewport-input.js';
let doorControls;const linkedPreview=new Map();
let interactionPreview;
let volumeCut;
let sceneTree,contextList,uvEditor,editor,layerEditor,subEditor,scaleEditor,faceOrientation,shadowEditor,lightEditor,glassEditor;
const $ = id => document.getElementById(id);
const status = text => $('status').textContent = text;
const saveState=new ProjectSaveState();let checkingClose=false;
function markDirty(){saveState.changed();document.title='* Arma 3 Better Tools';}
function markSaved(){saveState.clean();document.title='Arma 3 Better Tools';}
async function saveProject(saveAs=false){
  if(!root)return false;document.activeElement?.blur();
  return saveState.save(async()=>{try{restore();root.updateWorldMatrix(true,true);
    const text=JSON.stringify({format:'calipo-creator',version:1,name:fileName,doors,model:root.toJSON()});
    if(window.desktop?.project){
      let preview=null;try{renderer.render(scene,camera);const canvas=document.createElement('canvas');canvas.width=320;canvas.height=200;canvas.getContext('2d').drawImage(renderer.domElement,0,0,320,200);preview=canvas.toDataURL('image/jpeg',.75);}catch{}
      const result=await window.desktop.project.save(text,fileName.replace(/\.[^.]+$/,''),saveAs===true,preview);if(!result.ok)return false;
    }
    else{const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=fileName.replace(/\.[^.]+$/,'')+'.calipo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    status('Proyecto guardado.');return true;
  }catch(e){status('No se pudo guardar: '+e.message);return false;}}).then(ok=>{if(ok)document.title='Arma 3 Better Tools';return ok;});
}
async function mayClose(){return saveState.mayClose(()=>window.desktop?.project?window.desktop.project.confirmClose():Promise.resolve(confirm(t('Hay cambios sin guardar. ¿Continuar sin guardarlos?'))?'discard':'cancel'),saveProject);}
window.desktop?.project?.onClose(async()=>{if(checkingClose)return;checkingClose=true;try{if(await mayClose())await window.desktop.project.close();}finally{checkingClose=false;}});
window.addEventListener('beforeunload',e=>{if(saveState.dirty&&!window.desktop){e.preventDefault();e.returnValue='';}});
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveProject();}});

const scene = new THREE.Scene(); scene.background = new THREE.Color('#171b20');
const camera = new THREE.PerspectiveCamera(45,1,.01,10000);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.outputColorSpace=THREE.SRGBColorSpace;
$('viewport').append(renderer.domElement);
const controls = new OrbitControls(camera,renderer.domElement); controls.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xdce9ff,0x625440,2.5));
const light = new THREE.DirectionalLight(0xfff0de,3); light.position.set(5,10,7); scene.add(light);
let grid = new THREE.GridHelper(20,20,0x58616d,0x303943); scene.add(grid);
let chosen=[];
let memberMode=false;
let root=null, meshes=[], selected=null, baseLocal=null, baseWorld=null, doors={}, playing=false, progress=0, fileName='';
const axis = new THREE.Group(); scene.add(axis); axis.visible=false;
const axisLine = new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xffa05c,depthTest:false})); axisLine.renderOrder=10; axis.add(axisLine);
const dot = new THREE.Mesh(new THREE.SphereGeometry(.04),new THREE.MeshBasicMaterial({color:0xffb378,depthTest:false}));dot.renderOrder=11;axis.add(dot);
const highlight = new THREE.Box3Helper(new THREE.Box3(),0xeaa36c);highlight.visible=false;scene.add(highlight);
new ResizeObserver(()=>{const r=$('viewport').getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}).observe($('viewport'));
function restore(){playing=false;for(const [object,state] of linkedPreview){object.matrix.copy(state.matrix);object.matrixAutoUpdate=state.auto;object.updateMatrixWorld(true);}linkedPreview.clear();if(selected&&baseLocal){selected.matrix.copy(baseLocal);selected.matrixAutoUpdate=false;selected.updateMatrixWorld(true);}progress=0;$('progress').value=0;$('progressValue').value='0%';$('play').textContent='▶ Probar apertura';}
function clearSelection(){scaleEditor?.stopGizmo();interactionPreview?.stopGizmo();restore();memberMode=false;$('memberContext').hidden=true;$('addToDoor').disabled=true;$('addToDoor').textContent='Añadir a puerta existente';$('doorManagement').hidden=true;chosen=[];$('groupDoor').disabled=true;selected=null;baseLocal=null;baseWorld=null;axis.visible=false;highlight.visible=false;$('settings').disabled=true;$('selectionName').removeAttribute('data-no-i18n');$('selectionName').textContent='Selecciona una pieza';}
function dispose(object){object.traverse(o=>{o.geometry?.dispose();for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(!m)continue;for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});}
function mount(model,name,config={},fromHistory=false){if(!fromHistory){markDirty();window.desktop?.project?.reset();}clearSelection();if(root){scene.remove(root);if(!fromHistory)dispose(root);}root=model;fileName=name;doors=config;scene.add(root);root.updateMatrixWorld(true);meshes=[];root.traverse(o=>{if(o.isMesh){meshes.push(o);}});sceneTree?.render();$('count').textContent=meshes.length;$('modelName').setAttribute('data-no-i18n','');$('modelName').textContent=name;$('empty').hidden=true;$('save').disabled=false;renderDoors();if(!fromHistory){editor?.reset();frame();}layerEditor?.rebuild();subEditor?.reset();scaleEditor?.update();status(`${name} · ${meshes.length} piezas. Selecciona la puerta.`);}
function frame(){if(!root)return;scaleEditor?.update();const box=new THREE.Box3().setFromObject(root);if(scaleEditor)box.union(scaleEditor.bounds());if(box.isEmpty())return;const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()).length()||1;camera.position.copy(center).add(new THREE.Vector3(1,.65,1).normalize().multiplyScalar(size*1.5));controls.target.copy(center);camera.near=size/1000;camera.far=size*100;camera.updateProjectionMatrix();controls.maxDistance=size*20;grid.position.y=box.min.y;grid.scale.setScalar(size/10);controls.update();}
function selectionTarget(mesh){return selectionObject(mesh,root);}
function updateHighlight(){
  highlight.box.makeEmpty();
  for(const object of chosen)highlight.box.union(new THREE.Box3().setFromObject(object));
  highlight.visible=chosen.length>0;
}
function select(mesh,additive=false,individual=false){scaleEditor?.stopGizmo();interactionPreview?.stopGizmo();if(subEditor?.active())subEditor.setMode('objects');
  if(layerEditor?.active()){layerEditor.selectPiece(mesh);return;}
  restore();
  const wasMember=memberMode;
  memberMode=individual&&!!doorOwner(mesh,root)&&!mesh.userData.calipoDoor;
  if(memberMode||wasMember)additive=false;
  const target=selectionObject(mesh,root,memberMode);
  chosen=additive?(chosen.includes(target)?chosen.filter(o=>o!==target):[...chosen,target]):[target];
  finishSelection();
}
function finishSelection(){
  selected=chosen.length===1?chosen[0]:null;
  baseLocal=null;baseWorld=null;axis.visible=false;
  $('groupDoor').disabled=memberMode||chosen.length===0;
  $('settings').disabled=memberMode||!selected;
  $('selectionName').toggleAttribute('data-no-i18n',chosen.length===1&&!!selected?.name);$('selectionName').textContent=chosen.length>1?chosen.length+' piezas seleccionadas':selected?.name||'Selecciona una pieza';
  $('selectionHint').textContent=chosen.length>1?'Puedes crear una puerta nueva o añadir las piezas a la puerta seleccionada.':'Ctrl + clic añade o quita piezas. Una puerta agrupada se selecciona completa.';
  for(const b of $('tree').children){const mesh=meshes.find(m=>m.uuid===b.dataset.uuid);const active=chosen.includes(selectionObject(mesh,root,memberMode));b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));}
  updateHighlight();
  renderDoors();
  editor?.refresh();if(!selected)return;
  selected.updateWorldMatrix(true,false);baseLocal=selected.matrix.clone();baseWorld=selected.matrixWorld.clone();selected.matrixAutoUpdate=false;
  if(memberMode){updateHighlight();renderDoors();return;}
  if(!doors[selected.uuid])doors[selected.uuid]={...proposeAxis(selected),confirmed:false};
  sync();renderDoors();
}
$('groupDoor').onclick=()=>{
  if(memberMode||chosen.length===0)return;
  restore();
  const count=chosen.length;
  const group=groupDoor(root,chosen);
  group.traverse(o=>{if(o!==group)delete doors[o.uuid];});
  selected=null;baseLocal=null;baseWorld=null;
  select(group);
  doors[group.uuid].confirmed=true;
  doors[group.uuid].actionOpen=getLanguage()==='en'?'Open':'Abrir';doors[group.uuid].actionClose=getLanguage()==='en'?'Close':'Cerrar';sync();renderDoors();
  status('Puerta creada con '+count+' piezas. Ahora comparten eje y apertura.');
};

function additionSelection(){
  if(memberMode)return {target:null,pieces:[],targetCount:0};
  const targets=chosen.filter(o=>doors[o.uuid]&&doors[o.uuid].confirmed!==false);
  return {target:targets.length===1?targets[0]:null, pieces:chosen.filter(o=>!targets.includes(o)), targetCount:targets.length};
}
function refreshAddButton(){
  const {target,pieces,targetCount}=additionSelection();
  $('addToDoor').disabled=!target||pieces.length===0;
  $('addToDoor').textContent=target&&pieces.length?'Añadir '+pieces.length+' pieza(s) a «'+(target.name||'Puerta')+'»':'Añadir a puerta existente';
  $('addToDoorHint').textContent=targetCount>1?'Selecciona una sola puerta de destino. Para mover piezas de otra puerta, quítalas de ella primero.':'Selecciona una puerta y añade piezas con Ctrl + clic. Se conservan su nombre, eje y ángulo.';
}
$('addToDoor').onclick=()=>{
  const {target,pieces}=additionSelection();
  if(!target||!pieces.length)return;
  restore();
  const config=doors[target.uuid];
  const group=addDoorPieces(root,target,pieces);
  if(group!==target)delete doors[target.uuid];
  for(const piece of pieces)piece.traverse(o=>{delete doors[o.uuid];});
  doors[group.uuid]=config;
  selected=null;baseLocal=null;baseWorld=null;
  select(group);
  status('Piezas añadidas a «'+group.name+'». Se conservan su eje y su ángulo de apertura.');
};
function renderDoors(){scaleEditor?.update();
  editor?.refresh();
  refreshAddButton();
  contextList?.update();
  const owner=memberMode&&selected?doorOwner(selected,root):null;
  $('memberContext').hidden=!owner;
  if(owner){$('memberOwnerName').textContent=owner.name||'Puerta';$('selectionHint').textContent='Editando solo esta pieza. Sigue dentro de la puerta; su eje no cambia.';}
  const registered=!memberMode&&selected&&doors[selected.uuid]?.confirmed!==false&&doors[selected.uuid];
  document.getElementById('doorInteractionPanel')?.sync(registered);doorControls?.sync(registered);
  $('doorManagement').hidden=!registered;
  $('members').replaceChildren();
  if(!registered)return;
  $('doorName').value=selected.name||'';
  for(const [id,prefix] of [['actionOpen','Abrir '],['actionClose','Cerrar ']]){
    $(id).value=typeof registered[id]==='string'?registered[id]:'';
    $(id).placeholder=prefix+(selected.name||'puerta');
  }
  $('ungroup').textContent=selected.userData.calipoDoor?'Desagrupar puerta':'Quitar definición de puerta';
  const pieces=[];selected.traverse(o=>{if(o.isMesh)pieces.push(o);});
  for(const piece of pieces){const row=document.createElement('div');row.className='member-row';const label=document.createElement('span');label.textContent=piece.name||'Pieza sin nombre';row.append(label);
    if(selected.userData.calipoDoor){const edit=document.createElement('button');edit.textContent='Editar';edit.title='Editar solo '+label.textContent;edit.onclick=()=>select(piece,false,true);row.append(edit);}
    if(selected.userData.calipoDoor){const b=document.createElement('button');b.textContent='Quitar';b.title='Sacar '+label.textContent+' de la puerta, conservándolo en el modelo';b.onclick=()=>removeMember(piece);row.append(b);}
    $('members').append(row);
  }
}
function refreshSceneSelection(){
  for(const b of $('tree').children){b.classList.remove('selected');b.setAttribute('aria-pressed','false');}
  renderDoors();
}
function removeMember(piece){
  const group=selected;if(!group?.userData.calipoDoor)return;
  editor.record('Quitar pieza de puerta');
  restore();
  detachPiece(root,piece);
  piece.traverse(o=>delete doors[o.uuid]);
  let hasMesh=false;group.traverse(o=>{if(o.isMesh)hasMesh=true;});
  clearSelection();
  if(hasMesh)select(group);
  else{delete doors[group.uuid];group.removeFromParent();refreshSceneSelection();}
  status('Pieza retirada de la puerta. Sigue en el modelo, en su posición cerrada.');
}
$('ungroup').onclick=()=>{
  const object=selected;if(!object)return;
  clearSelection();
  object.traverse(o=>{delete doors[o.uuid];});
  if(object.userData.calipoDoor)ungroupDoor(root,object);
  refreshSceneSelection();
  status('Puerta desagrupada. Sus piezas permanecen en el modelo y se pueden seleccionar por separado.');
};
$('doorName').onchange=()=>{
  if(!selected)return;
  selected.name=$('doorName').value.trim()||'Puerta sin nombre';
  $('selectionName').setAttribute('data-no-i18n','');$('selectionName').textContent=selected.name;renderDoors();
};

const actionFields=document.createElement('section');
actionFields.innerHTML=`<label for="actionOpen">Texto de la rueda: abrir</label><input id="actionOpen" type="text" maxlength="100" placeholder="Abrir puerta"><label for="actionClose">Texto de la rueda: cerrar</label><input id="actionClose" type="text" maxlength="100" placeholder="Cerrar puerta"><p class="hint">Escribe el texto completo, por ejemplo «Entrar a recepción» y «Cerrar acceso». Si lo dejas vacío se usa Abrir/Cerrar seguido del nombre de la puerta. Se aplica al volver a exportar.</p>`;
$('doorName').after(actionFields);
const doorInteraction=interactionFields($('doorManagement'),'door',patch=>{
 if(!selected||!doors[selected.uuid])return;editor.record('Editar interacción');Object.assign(doors[selected.uuid],patch);syncDoorSwitch(doors,selected.uuid);renderDoors();
},()=>{if(selected)window.dispatchEvent(new CustomEvent('edit-door-memory',{detail:{id:selected.uuid}}));});
doorInteraction.id='doorInteractionPanel';
doorControls=installDoorControls($('doorManagement'),{root:()=>root,doors:()=>doors,selected:()=>selected,close:restore,record:label=>editor.record(label),refresh:()=>{renderDoors();sync();},status});
for(const id of ['actionOpen','actionClose'])$(id).onchange=()=>{
  if(!selected||!doors[selected.uuid]||memberMode)return;
  const value=$(id).value.trim();if(value===(doors[selected.uuid][id]||''))return;
  editor.record('Cambiar texto de acción');
  if(value)doors[selected.uuid][id]=value;else delete doors[selected.uuid][id];
  syncDoorSwitch(doors,selected.uuid);renderDoors();status('Texto de acción guardado. Vuelve a exportar el addon para verlo en Arma. Ctrl + Z deshace.');
};

function sync(){if(memberMode){updateHighlight();return;}const d=doors[selected.uuid];document.querySelector('label[for="angle"]').hidden=d.motion==='translation';$('angle').hidden=d.motion==='translation';$('angleValue').hidden=d.motion==='translation';['px','py','pz'].forEach((id,i)=>$(id).value=Number(d.pivot[i].toFixed(4)));$('side').value=d.side;$('angle').value=d.angle;$('angleValue').value=d.angle+'°';updateAxis();preview();}
function updateAxis(){const d=doors[selected.uuid],p=new THREE.Vector3().fromArray(d.pivot);axisLine.geometry.dispose();axisLine.geometry=new THREE.BufferGeometry().setFromPoints([p,p.clone().add(d.motion==='translation'?new THREE.Vector3(...d.slide):new THREE.Vector3().fromArray(d.direction||[0,1,0]).multiplyScalar(d.height))]);dot.position.copy(p);dot.scale.setScalar(d.height*.035/.04);axis.visible=true;}
function preview(){if(!selected||memberMode)return;selected.parent.updateWorldMatrix(true,false);const d=doors[selected.uuid];selected.matrix.copy(d.motion==='translation'?slideMatrix(baseWorld,selected.parent.matrixWorld,d.slide,progress):doorMatrix(baseWorld,selected.parent.matrixWorld,d.pivot,THREE.MathUtils.degToRad(d.angle)*progress,d.direction));
if(d.switchId)for(const [id,other] of Object.entries(doors)){if(id===selected.uuid||other.switchId!==d.switchId)continue;const object=root.getObjectByProperty('uuid',id);if(!object)continue;if(!linkedPreview.has(object)){if(object.matrixAutoUpdate)object.updateMatrix();object.updateMatrixWorld(true);linkedPreview.set(object,{matrix:object.matrix.clone(),auto:object.matrixAutoUpdate});}object.parent.updateWorldMatrix(true,false);const world=object.parent.matrixWorld.clone().multiply(linkedPreview.get(object).matrix);object.matrixAutoUpdate=false;object.matrix.copy(other.motion==='translation'?slideMatrix(world,object.parent.matrixWorld,other.slide,progress):doorMatrix(world,object.parent.matrixWorld,other.pivot,THREE.MathUtils.degToRad(other.angle)*progress,other.direction));object.updateMatrixWorld(true);}selected.updateMatrixWorld(true);updateHighlight();$('progress').value=Math.round(progress*100);$('progressValue').value=Math.round(progress*100)+'%';}
$('auto').onclick=()=>{if(!selected)return;restore();doors[selected.uuid]={...doors[selected.uuid],...proposeAxis(selected,$('side').value)};sync();status('Eje propuesto. Revisa su posición y prueba la apertura.');};$('side').onchange=()=> $('auto').click();
['px','py','pz'].forEach((id,i)=>$(id).onchange=()=>{if(!Number.isFinite($(id).valueAsNumber)){sync();return;}doors[selected.uuid].pivot[i]=$(id).valueAsNumber;updateAxis();preview();});
$('angle').oninput=()=>{doors[selected.uuid].angle=Number($('angle').value);$('angleValue').value=$('angle').value+'°';preview();};
$('progress').oninput=()=>{playing=false;progress=Number($('progress').value)/100;$('play').textContent='▶ Probar apertura';preview();};
$('close').onclick=()=>{restore();preview();};$('play').onclick=()=>{playing=!playing;if(playing&&progress>=1)progress=0;$('play').textContent=playing?'Ⅱ Pausar':'▶ Probar apertura';};$('frame').onclick=frame;
let last=0;renderer.setAnimationLoop(time=>{if(playing&&selected){progress=Math.min(1,progress+Math.min((time-last)/1000,.05)/1.4);preview();if(progress>=1){playing=false;$('play').textContent='▶ Probar apertura';}}last=time;controls.update();interactionPreview?.update();shadowEditor?.update();uvEditor?.update();contextList?.update();const draw=()=>faceOrientation?faceOrientation.render(root,()=>renderer.render(scene,camera)):renderer.render(scene,camera);const glassDraw=()=>glassEditor?glassEditor.render(draw):draw();if(lightEditor)lightEditor.render(glassDraw);else glassDraw();});
function demo(tutorial=false){const g=new THREE.Group();const add=(name,size,pos,color)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,roughness:.8}));m.name=name;m.position.set(...pos);g.add(m);return m;};add('Pared izquierda',[1.8,3,.22],[-1.5,1.5,0],0x8b969b);add('Pared derecha',tutorial?[1.8,.9,.22]:[1.8,3,.22],tutorial?[1.5,.45,0]:[1.5,1.5,0],0x8b969b);add('Dintel',[1.2,.75,.22],[0,2.625,0],0xa0a8a7);add('Suelo',[5,.12,3],[0,-.06,0],0x59636c);const door=add('Puerta principal',[1.16,2.22,.12],[0,1.11,0],0xa67851);add('Manilla',[.22,.06,.08],[.36,1.08,.10],0xc7cbd0);if(tutorial){add('Dintel ventana',[1.8,.9,.22],[1.5,2.55,0],0x8b969b);add('Marco izquierdo',[.2,1.2,.22],[.7,1.5,0],0x8b969b);add('Marco derecho',[.2,1.2,.22],[2.3,1.5,0],0x8b969b);const glass=add('Cristal',[1.4,1.2,.025],[1.5,1.5,0],0xb8d4df);glass.material.transparent=true;glass.material.opacity=.3;add('Luminaria',[.5,.08,.25],[0,2.8,.3],0xffffff);add('Interruptor',[.08,.12,.05],[.7,1.1,.15],0xe4e4e4);}mount(g,'Edificio de ejemplo');select(door);}
$('demo').onclick=demo;
for(const id of ['import','importEmpty'])$(id).onclick=async()=>{if(await mayClose())$('files').click();};
$('files').onchange=async()=>{const files=[...$('files').files];$('files').value='';const models=files.filter(f=>/\.(glb|gltf|fbx)$/i.test(f.name));if(models.length!==1){status('Selecciona un único modelo GLB, GLTF o FBX, junto con sus texturas y archivos auxiliares.');return;}const file=models[0],urls=new Map();let missing=[];try{status('Importando '+file.name+'…');const manager=new THREE.LoadingManager();let loading=false;const loaded=new Promise(resolve=>{manager.onStart=()=>{loading=true;};manager.onLoad=resolve;});files.forEach(f=>urls.set(f.name,URL.createObjectURL(f)));manager.setURLModifier(url=>{if(url.startsWith('data:')||url.startsWith('blob:'))return url;const name=decodeURIComponent(url.replaceAll('\\','/').split('/').pop());if(urls.has(name))return urls.get(name);throw new Error('Falta el archivo '+name+'. Selecciónalo junto al modelo.');});manager.onError=url=>missing.push(url);const bytes=await file.arrayBuffer();const model=/\.fbx$/i.test(file.name)?new FBXLoader(manager).parse(bytes,''):(await new GLTFLoader(manager).parseAsync(bytes,'')).scene;if(loading)await loaded;if(!new THREE.Box3().setFromObject(model).isEmpty()){mount(model,file.name);if(missing.length)status('Modelo importado, pero no se pudieron cargar algunas texturas.');}else throw new Error('El modelo no contiene geometría visible.');}catch(e){status('No se pudo importar: '+e.message);}finally{for(const url of urls.values())URL.revokeObjectURL(url);}};
$('save').onclick=()=>saveProject();
async function openSavedProject(project){try{const p=JSON.parse(project.text);if(p.format!=='calipo-creator'||p.version!==1||!p.model)throw new Error('Formato de proyecto no compatible.');for(const d of Object.values(p.doors||{}))if((d.direction&&(!Array.isArray(d.direction)||d.direction.length!==3||!d.direction.every(Number.isFinite)||Math.hypot(...d.direction)<1e-8))||!Array.isArray(d.pivot)||d.pivot.length!==3||!d.pivot.every(Number.isFinite)||!Number.isFinite(d.angle)||!Number.isFinite(d.height)||d.height<=0||!['min','max'].includes(d.side))throw new Error('Los datos del eje no son válidos.');for(const d of Object.values(p.doors||{}))validateDoorMotion(d);const model=await new THREE.ObjectLoader().parseAsync(p.model);mount(model,p.name||project.name,p.doors||{});markSaved();status('Proyecto recuperado. Selecciona una puerta para ver su eje.');return true;}catch(e){status('No se pudo abrir: '+e.message);return false;}}
let openProjectLibrary;
$('loadProject').onclick=async()=>{if(await mayClose()){if(openProjectLibrary)await openProjectLibrary();else $('projectFile').click();}};
$('projectFile').onchange=async()=>{const file=$('projectFile').files[0];$('projectFile').value='';if(file)await openSavedProject({text:await file.text(),name:file.name});};

editor=createEditor({
  camera,canvas:renderer.domElement,scene,controls,status,changed:markDirty,
  root:()=>root,selection:()=>layerEditor?.active()||subEditor?.active()?[]:chosen,doors:()=>doors,close:restore,
  capture:()=>({model:cloneScene(root),doors:structuredClone(doors),name:fileName,selection:chosen.map(o=>o.uuid),memberMode}),
  apply:snapshot=>{
    mount(cloneScene(snapshot.model),snapshot.name,structuredClone(snapshot.doors),true);
    snapshot.selection.forEach((id,i)=>{const o=root.getObjectByProperty('uuid',id);if(o)select(o,i>0,snapshot.memberMode);});
  },
  edited:()=>{
    if(selected){selected.updateWorldMatrix(true,false);baseLocal=selected.matrix.clone();baseWorld=selected.matrixWorld.clone();sync();}
    else updateHighlight();
  }
});
for(const [id,label] of [['groupDoor','Crear puerta'],['addToDoor','Añadir piezas a puerta'],['ungroup','Desagrupar puerta'],['auto','Ajustar eje'],['doorName','Renombrar puerta']]){
  const prop=id==='doorName'?'onchange':'onclick';const handler=$(id)[prop];
  $(id)[prop]=event=>{if(!root)return;editor.record(label);handler(event);};
}
for(const id of ['px','py','pz']){const handler=$(id).onchange;$(id).onchange=e=>{if(Number.isFinite($(id).valueAsNumber))editor.record('Mover eje');handler(e);};}
$('angle').addEventListener('pointerdown',()=>editor.record('Cambiar ángulo de puerta'));
$('angle').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))editor.record('Cambiar ángulo de puerta');});
for(const id of ['play','progress'])$(id).addEventListener('pointerdown',()=>editor.stopGizmo());

$('backToDoor').onclick=()=>{const owner=selected&&doorOwner(selected,root);if(owner)select(owner);};

installExportUI({root:()=>root,doors:()=>doors,close:restore,status,applyScale:factor=>scaleEditor.apply(factor)});

layerEditor=installLayerEditor({camera,canvas:renderer.domElement,scene,controls,status,root:()=>root,doors:()=>doors,close:restore,clear:clearSelection,stopGizmo:()=>editor.stopGizmo(),record:label=>editor.record(label)});

subEditor=installSubobjects({scene,camera,controls,canvas:renderer.domElement,root:()=>root,close:restore,clear:clearSelection,stop:()=>editor.stopGizmo(),record:label=>editor.record(label),status});
installRecalculate({root:()=>root,close:restore,selection:()=>subEditor.active()?subEditor.selectedObjects():layerEditor.active()?layerEditor.selectedObjects():chosen,record:label=>editor.record(label),refresh:()=>layerEditor.rebuild(),status});
scaleEditor=installScaleEditor({scene,camera,controls,canvas:renderer.domElement,stopOthers:()=>{subEditor.setMode('objects');if(layerEditor.active()){$('layerMode').value='visual';$('layerMode').dispatchEvent(new Event('change'));}editor.stopGizmo();layerEditor.stopGizmo();subEditor.stopGizmo();},root:()=>root,doors:()=>doors,close:restore,clear:clearSelection,record:label=>editor.record(label),refresh:()=>{layerEditor.rebuild();subEditor.reset();},frame,status});
function selectBatch(objects,gesture){scaleEditor.stopGizmo();interactionPreview?.stopGizmo();
  restore();memberMode=false;const targets=[...new Set(objects.map(o=>selectionObject(o,root)))];
  chosen=gesture.subtract?chosen.filter(o=>!targets.includes(o)):gesture.ctrl?[...new Set([...chosen,...targets])]:targets;
  finishSelection();
}
installViewportInput({canvas:renderer.domElement,controls,navigate:active=>{scene.traverse(o=>{if(o.isTransformControlsRoot){o.controls.enabled=!active;}});},layerActive:()=>layerEditor.active(),busy:()=>volumeCut?.busy()||editor.isBusy()||layerEditor.busy()||subEditor.busy()||scaleEditor.busy()||interactionPreview?.busy(),dragging:()=>volumeCut?.isDragging()||editor.isDragging()||layerEditor.isDragging()||subEditor.isDragging()||scaleEditor.isDragging()||interactionPreview?.isDragging(),stopGizmo:()=>{volumeCut?.stopGizmo();editor.stopGizmo();layerEditor.stopGizmo();subEditor.stopGizmo();scaleEditor.stopGizmo();interactionPreview?.stopGizmo();},
  box:(rect,gesture)=>{if(subEditor.box(rect,gesture))return;selectBatch(meshesInRectangle(meshes,camera,rect),gesture);status(`${chosen.length} objetos seleccionados. El rectángulo incluye piezas ocultas detrás si quedan completamente dentro.`);},
  click:(e,gesture)=>{const r=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);if(volumeCut?.pick(ray)||interactionPreview?.pick(ray)||scaleEditor.pick(ray))return;scaleEditor.stopGizmo();interactionPreview?.stopGizmo();if(layerEditor.pick(ray)||subEditor.click(ray,e,gesture))return;const hit=ray.intersectObjects(meshes,false).find(h=>{for(let p=h.object;p;p=p.parent)if(!p.visible)return false;return true;});selectBatch(hit?[hit.object]:[],gesture);}
});

faceOrientation=installFaceOrientation();

shadowEditor=installShadows({scene,renderer,light,root:()=>root,selection:()=>chosen,close:restore,record:label=>editor.record(label),refresh:()=>layerEditor.rebuild(),status});
lightEditor=installLights({scene,root:()=>root,selection:()=>chosen,doors:()=>doors,close:restore,record:label=>editor.record(label),status});
glassEditor=installGlass({root:()=>root,selection:()=>chosen,doors:()=>doors,select,close:restore,record:label=>editor.record(label),status});

uvEditor=installUVEditor({selection:()=>chosen,close:restore,record:label=>editor.record(label),status,stop:()=>{subEditor.setMode('objects');if(layerEditor.active()){$('layerMode').value='visual';$('layerMode').dispatchEvent(new Event('change'));}editor.stopGizmo();layerEditor.stopGizmo();}});
installMaterialLibrary({root:()=>root,selection:()=>chosen,close:restore,record:label=>editor.record(label),status,openUV:()=>uvEditor.open()});
contextList=installContextList({root:()=>root,doors:()=>doors,selection:()=>chosen,select,
  locate(object){select(object);focusElement(camera,controls,object);status('Localizado: '+(object.name||'Elemento')+'. Usa Encuadrar modelo para volver al edificio completo.');},
  rename(entry,name){
    if(!name.trim()){status('Escribe un nombre para el elemento.');return false;}
    if(name.trim()===entry.label)return true;
    restore();editor.record('Renombrar elemento');renameConfigured(root,entry,name);
    for(const b of $('tree').children){const object=root.getObjectByProperty('uuid',b.dataset.uuid);if(object)b.querySelector('.piece-label').textContent=object.name||'Pieza';}
    if(selected){$('selectionName').setAttribute('data-no-i18n','');$('selectionName').textContent=selected.name;if(doors[selected.uuid])$('doorName').value=selected.name;}
    renderDoors();status('Nombre guardado. Ctrl + Z deshace.');return true;
  }
});
installLadders({root:()=>root,doors:()=>doors,selection:()=>chosen,close:restore,record:label=>editor.record(label),refresh:()=>layerEditor.rebuild(),status});
installSeats({root:()=>root,doors:()=>doors,selection:()=>chosen,record:label=>editor.record(label),refresh:()=>{layerEditor.rebuild();contextList?.update();},finishAdjustment:()=>{interactionPreview?.stopGizmo();layerEditor.stopGizmo();},status});
interactionPreview=installInteractionPreview({scene,root:()=>root,camera,canvas:renderer.domElement,orbit:controls,record:label=>editor.record(label),stopOthers:()=>{restore();editor.stopGizmo();layerEditor.stopGizmo();subEditor.stopGizmo();scaleEditor.stopGizmo();interactionPreview?.stopGizmo();},refresh:()=>layerEditor.rebuild(),status});
installCopySettings({root:()=>root,doors:()=>doors,close:restore,record:label=>editor.record(label),refresh:()=>{renderDoors();if(selected&&doors[selected.uuid])sync();},status});
installPolyHaven({root:()=>root,add:model=>{
  if(!root){const container=new THREE.Group();mount(container,'Proyecto');}
  editor.record(getLanguage()==='en'?'Add Poly Haven model':'Añadir modelo de Poly Haven');
  root.add(model);mount(root,fileName,doors,true);editor.refresh();frame();
}});
const interiors=installInteriors({scene,selection:()=>chosen,status,commit:room=>{
  restore();if(!root)mount(new THREE.Group(),getLanguage()==='en'?'Interior project':'Proyecto de interior');
  root.updateWorldMatrix(true,true);
  if(Math.abs(root.matrixWorld.determinant())<1e-12)throw Error(getLanguage()==='en'?'The model has zero scale.':'El modelo tiene escala nula.');
  editor.record(getLanguage()==='en'?'Create room':'Crear habitación');
  room.updateMatrixWorld(true);const world=room.matrixWorld.clone();root.add(room);
  room.matrix.copy(root.matrixWorld).invert().multiply(world);room.matrixAutoUpdate=false;
  mount(root,fileName,doors,true);select(room);frame();
}});
volumeCut=installVolumeCut({scene,camera,canvas:renderer.domElement,controls,stopOthers:()=>{editor.stopGizmo();layerEditor.stopGizmo();subEditor.stopGizmo();scaleEditor.stopGizmo();interactionPreview?.stopGizmo();},root:()=>root,doors:()=>doors,selection:()=>chosen,close:restore,record:label=>editor.record(label),refresh:()=>mount(root,fileName,doors,true),status});
installExistingInterior({root:()=>root,doors:()=>doors,close:restore,record:label=>editor.record(label),refresh:()=>mount(root,fileName,doors,true),status});
installPropertyTabs({onChange:tab=>{contextList.setTab(tab);if(tab!=='interiors'){interiors.clear();volumeCut.clear();}},leaveComponents:()=>{if(subEditor.active())subEditor.setMode("objects");},stopGizmos:()=>{editor.stopGizmo();layerEditor.stopGizmo();subEditor.stopGizmo();scaleEditor.stopGizmo();interactionPreview?.stopGizmo();}});

installAppSettings({mayClose,status});
openProjectLibrary=installWorkspaceUI({open:openSavedProject,save:saveProject,status});
sceneTree=installSceneTree({root:()=>root,selection:()=>chosen,record:label=>editor.record(label),clear:()=>{clearSelection();editor.stopGizmo();},select,selectMany:(objects,ctrl=false)=>selectBatch(objects,{ctrl})});
installEditorShell({root:()=>root,selection:()=>subEditor.active()?subEditor.selectedObjects():chosen});
const deleteObjects=document.createElement('button');
deleteObjects.id='deleteObjects';deleteObjects.textContent='Eliminar objetos seleccionados';
$('editPanel').prepend(deleteObjects);
installPlacement({root:()=>root,selection:()=>layerEditor.active()||subEditor.active()?[]:chosen,doors:()=>doors,close:restore,record:label=>editor.record(label),status,
  snap:(step,degrees)=>editor.setSnapping(step,degrees),
  refresh:objects=>{mount(root,fileName,doors,true);objects.forEach((o,i)=>select(o,i>0));editor.refresh();}
});
const faceDoor=document.createElement('details');faceDoor.id='faceDoorTools';faceDoor.setAttribute('data-no-i18n','');
faceDoor.innerHTML='<summary></summary><label><span></span><input id="faceDoorThickness" type="number" value="0.04" min="0.005" max="1" step="0.005"></label><label><span id="faceDoorTypeLabel"></span><select id="faceDoorType"><option value="rotation"></option><option value="garage-up"></option><option value="garage-side"></option></select></label><p></p><button id="createFaceDoor" class="primary"></button>';
$('componentTools').append(faceDoor);
const faceDoorLanguage=()=>{
  const en=getLanguage()==='en';
  faceDoor.querySelector('summary').textContent=en?'Door from selected faces':'Puerta desde caras seleccionadas';
  faceDoor.querySelector('label span').textContent=en?'Thickness inward (m)':'Grosor hacia dentro (m)';
  faceDoor.querySelector('p').textContent=en?'Select a flat, vertical rectangle on one part. Extracts those faces and closes the door edges. Then use Connect opening to interior and floor in the door panel.':'Selecciona un rectángulo plano y vertical de una sola pieza. Extrae esas caras y cierra los cantos de la puerta. Después usa Conectar hueco con interior y suelo en el panel de la puerta.';
  $('faceDoorTypeLabel').textContent=en?'Opening type':'Tipo de apertura';['Abatible|Hinged','Garaje · subir panel|Garage · lift panel','Garaje · lateral|Garage · sideways'].forEach((label,i)=>$('faceDoorType').options[i].text=label.split('|')[en?1:0]);
  $('createFaceDoor').textContent=en?'Create door with thickness':'Crear puerta con grosor';
};faceDoorLanguage();onLanguage(faceDoorLanguage);
$('createFaceDoor').onclick=()=>{
  try{
    if(!root)return;
    restore();const result=prepareFaceDoor(root,subEditor.selectedFaces(),doors,$('faceDoorThickness').valueAsNumber);
    editor.record(getLanguage()==='en'?'Create door from faces':'Crear puerta desde caras');
    result.source.geometry=result.remaining;
    if(result.empty){delete doors[result.source.uuid];result.source.removeFromParent();}
    root.add(result.door);
    const group=groupDoor(root,[result.door]);
    doors[group.uuid]={...proposeAxis(group),confirmed:true,actionOpen:getLanguage()==='en'?'Open':'Abrir',actionClose:getLanguage()==='en'?'Close':'Cerrar'};
    if($('faceDoorType').value!=='rotation')Object.assign(doors[group.uuid],garageMotion(group,$('faceDoorType').value));
    subEditor.setMode('objects');mount(root,fileName,doors,true);select(group);$('tab-doors').click();
    status(getLanguage()==='en'?'Door created. Check the hinge and the wall opening/collision. Ctrl+Z undoes.':'Puerta creada. Revisa la bisagra, el hueco de pared y las colisiones. Ctrl+Z deshace.');
  }catch(e){status(e.message);}
};
const duplicateProxy=document.createElement('button');
installFaceWindow({root:()=>root,faces:()=>subEditor.selectedFaces(),doors:()=>doors,close:restore,record:label=>editor.record(label),refresh:group=>{subEditor.setMode('objects');mount(root,fileName,doors,true);select(group);$('tab-glass').click();},status});
duplicateProxy.id='duplicateProxy';duplicateProxy.setAttribute('data-no-i18n','');
const proxyLabel=()=>{duplicateProxy.textContent=getLanguage()==='en'?'Duplicate as proxy':'Duplicar como proxy';};
proxyLabel();onLanguage(proxyLabel);$('editPanel').prepend(duplicateProxy);
duplicateProxy.onclick=()=>{
  if(!root||chosen.length!==1){status(getLanguage()==='en'?'Select one furniture item.':'Selecciona un solo mueble.');return;}
  try{
    restore();const source=validateFurniture(root,furnitureRoot(chosen[0],root),doors);
    editor.record(getLanguage()==='en'?'Duplicate furniture proxy':'Duplicar mueble como proxy');
    const copy=duplicateFurniture(root,source,doors);
    mount(root,fileName,doors,true);editor.refresh();select(copy);
    status(getLanguage()==='en'?'Proxy created. Move or rotate it; Ctrl+Z undoes.':'Proxy creado. Puedes moverlo o girarlo; Ctrl+Z deshace.');
  }catch(e){status(e.message);}
};
deleteObjects.onclick=()=>{
  if(!root||!chosen.length||subEditor.active()||layerEditor.active())return;
  const message=getLanguage()==='en'?'Delete the selected objects and their associated settings? Lights linked to a deleted switch will also lose their configuration. Ctrl+Z undoes this.':'¿Eliminar los objetos seleccionados y sus ajustes asociados? Las luces vinculadas a un interruptor eliminado también perderán su configuración. Ctrl+Z permite deshacer.';
  if(!confirm(message))return;
  editor.record('Eliminar objetos');
  deleteModelObjects(root,[...chosen],doors);
  mount(root,fileName,doors,true);editor.refresh();
  status(getLanguage()==='en'?'Objects deleted. Ctrl+Z to undo.':'Objetos eliminados. Ctrl+Z para deshacer.');
};

installUnifiedToolbar({editor,subEditor,layerEditor,volumeCut});
installTutorial({demo,mayClose,canvas:renderer.domElement,camera,controls,selection:()=>chosen});

