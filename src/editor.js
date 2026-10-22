import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { History } from './history.js';
import { topObjects, transformObjects, transformAxis, deltaMatrix, editMaterials, invertFaces } from './editing.js';
export function createEditor(api){
  const $=id=>document.getElementById(id);
  const flip=document.createElement('button');flip.id='invertFaces';flip.type='button';flip.textContent='Invertir caras de la selección';
  $('materialFields').append(flip);
  const hint=document.createElement('p');hint.className='hint';hint.textContent='Da la vuelta a todas las caras de las piezas seleccionadas. Conserva las UV. Para una pieza de una puerta, pulsa primero Editar junto a su nombre.';$('materialFields').append(hint);
  const history=new History(api.capture,api.apply);
  const gizmo=new TransformControls(api.camera,api.canvas);
  const proxy=new THREE.Object3D();api.scene.add(proxy,gizmo.getHelper());
  let mode='select',dragging=false,suppress=false,records=[],axisRecords=[],start=null;
  function buttons(){ $('undo').disabled=!history.past.length;$('redo').disabled=!history.future.length; }
  function record(label){api.close();history.record(label);api.changed?.();buttons();}
  function refresh(){
    buttons();if(dragging)return;
    const objects=api.selection();$('editFields').disabled=!objects.length;$('materialFields').disabled=!objects.length;
    gizmo.detach();if(!objects.length||mode==='select')return;
    const box=new THREE.Box3();objects.forEach(o=>box.union(new THREE.Box3().setFromObject(o)));
    proxy.position.copy(box.getCenter(new THREE.Vector3()));proxy.quaternion.identity();proxy.scale.set(1,1,1);proxy.updateMatrixWorld(true);
    gizmo.setMode(mode);gizmo.setSpace('world');gizmo.attach(proxy);
  }
  function setMode(value){api.close();mode=value;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));refresh();}
  function prepare(){
    const objects=topObjects(api.selection());
    records=objects.map(object=>{object.updateWorldMatrix(true,true);return {object,world:object.matrixWorld.clone()};});
    axisRecords=[];for(const object of objects)object.traverse(o=>{const config=api.doors()[o.uuid];if(config)axisRecords.push({id:o.uuid,config:structuredClone(config)});});
  }
  function applyDelta(delta){
    if(Math.abs(delta.determinant())<1e-10)return;
    transformObjects(records,delta);
    for(const {id,config} of axisRecords)api.doors()[id]=transformAxis(config,delta);
    api.edited();
  }
  gizmo.addEventListener('dragging-changed',e=>{api.controls.enabled=!e.value;});
  gizmo.addEventListener('mouseDown',()=>{record('Transformar objetos');prepare();start=proxy.matrixWorld.clone();dragging=true;suppress=true;});
  gizmo.addEventListener('objectChange',()=>{if(!dragging)return;proxy.updateMatrixWorld(true);applyDelta(proxy.matrixWorld.clone().multiply(start.clone().invert()));});
  gizmo.addEventListener('mouseUp',()=>{dragging=false;refresh();setTimeout(()=>suppress=false,0);});
  function travel(redo){if(dragging)return;api.close();const label=redo?history.redo():history.undo();refresh();if(label){api.changed?.();api.status((redo?'Rehecho: ':'Deshecho: ')+label);}}
  $('undo').onclick=()=>travel(false);$('redo').onclick=()=>travel(true);
  window.addEventListener('keydown',e=>{
    if(e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();travel(e.key.toLowerCase()==='y'||e.shiftKey);}
  });
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
  $('applyTransform').onclick=()=>{
    const read=prefix=>['X','Y','Z'].map(a=>$(prefix+a).valueAsNumber);
    const position=read('move'),rotation=read('rotate'),scale=read('scale');
    if(![...position,...rotation,...scale].every(Number.isFinite)||scale.some(v=>v<=0)){api.status('Introduce valores válidos y factores de escala mayores que cero.');return;}
    record('Ajustar objetos');prepare();
    const box=new THREE.Box3();records.forEach(r=>box.union(new THREE.Box3().setFromObject(r.object)));
    applyDelta(deltaMatrix(position,rotation.map(THREE.MathUtils.degToRad),scale,box.getCenter(new THREE.Vector3()).toArray()));
    for(const prefix of ['move','rotate','scale'])for(const a of ['X','Y','Z'])$(prefix+a).value=prefix==='scale'?1:0;
    refresh();api.status('Ajuste aplicado. Ctrl + Z lo deshace.');
  };
  $('applyMaterial').onclick=()=>{
    const rough=$('roughness').valueAsNumber,metal=$('metalness').valueAsNumber;
    if(![rough,metal].every(v=>Number.isFinite(v)&&v>=0&&v<=1)){api.status('Rugosidad y metálico deben estar entre 0 y 1.');return;}
    record('Cambiar material');
    editMaterials(api.selection(),m=>{m.color?.set($('materialColor').value);if('roughness'in m)m.roughness=rough;if('metalness'in m)m.metalness=metal;});
    api.status('Material actualizado. Rugosidad y metálico se aplican a materiales PBR compatibles.');
  };
  let textureTarget=null;
  $('applyTexture').onclick=()=>{textureTarget={root:api.root(),objects:[...api.selection()],flip:$('textureFlip').checked};$('textureFile').click();};
  $('textureFile').onchange=async()=>{
    const file=$('textureFile').files[0],target=textureTarget;$('textureFile').value='';if(!file||!target)return;
    try{
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
      const texture=await new THREE.TextureLoader().loadAsync(data);
      if(api.root()!==target.root||target.objects.some(o=>api.root().getObjectByProperty('uuid',o.uuid)!==o)){texture.dispose();api.status('La selección cambió de estructura: vuelve a seleccionar la textura.');return;}
      const meshes=[];target.objects.forEach(o=>o.traverse(c=>{if(c.isMesh)meshes.push(c);}));
      if(meshes.some(m=>!m.geometry.attributes.uv)){texture.dispose();api.status('Hay piezas sin coordenadas UV. Prepara sus UV en Blender antes de aplicar la textura.');return;}
      record('Aplicar textura');texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=target.flip;texture.needsUpdate=true;
      editMaterials(target.objects,m=>{m.map=texture;m.color?.set('#ffffff');});api.status('Textura aplicada a la selección.');
    }catch(error){api.status('No se pudo cargar la textura: '+(error.message||'archivo no válido'));}
  };
  $('removeTexture').onclick=()=>{record('Quitar textura');editMaterials(api.selection(),m=>{m.map=null;});api.status('Textura de color retirada.');};
  flip.onclick=()=>{if(!api.selection().length)return;record('Invertir caras');invertFaces(api.selection());api.edited();refresh();api.status('Caras invertidas. Se conserva al guardar y exportar. Ctrl + Z lo deshace.');};
  refresh();
  return {record,refresh,setMode,setSnapping(step,degrees){gizmo.setTranslationSnap(step);gizmo.setRotationSnap(degrees===null?null:THREE.MathUtils.degToRad(degrees));},reset(){history.clear();setMode('select');},isDragging:()=>dragging||suppress,isBusy:()=>dragging||suppress||!!gizmo.axis,stopGizmo(){setMode('select');}};
}
