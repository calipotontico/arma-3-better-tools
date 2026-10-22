import * as T from 'three';
import {prepareFaceDoor} from './face-door.js';
import {prepareBuildingVolumeCut} from './volume-cut.js';
import {openingParts,connectInteriorWall} from './opening-parts.js';
import {setShapes} from './layers.js';
import {doorOwner} from './selection.js';
import {proxyOwner} from './arma/proxy-export.js';
import {readLights} from './lighting-data.js';
import {sceneName} from './automatic-names.js';
import {getLanguage,onLanguage} from './i18n.js';
const tr=(es,en)=>getLanguage()==='en'?en:es;
export function prepareFaceWindow(root,entries,doors,{depth=.3,glass=true,bulletproof=false}={}){
 const patch=prepareFaceDoor(root,entries,doors,depth);let plan=null,extras=null;
 try{
  const source=patch.source,transform=source.matrixWorld.clone().invert().multiply(root.matrixWorld).multiply(patch.door.matrix);
  const axes=[0,1,2].map(i=>new T.Vector3().setFromMatrixColumn(transform,i).normalize());
  if(axes.some(a=>a.toArray().filter(n=>Math.abs(n)>1e-5).length!==1))throw Error(tr('La selección debe seguir los ejes locales de la pared. Alinea la pieza antes de crear la ventana.','The selection must follow the wall local axes. Align the part before creating the window.'));
  const normal=axes[2],values=normal.toArray().map(Math.abs),axis=values.indexOf(Math.max(...values));
  const box=new T.Box3(),p=patch.door.geometry.attributes.position;for(let i=0;i<p.count;i++)box.expandByPoint(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(transform));
  const epsilon=.02/ new T.Vector3().setFromMatrixColumn(source.matrixWorld,axis).length();box.min.setComponent(axis,box.min.getComponent(axis)-epsilon);box.max.setComponent(axis,box.max.getComponent(axis)+epsilon);
  const aperture=connectInteriorWall(source,root,box,axis),lights=readLights(root);
  const eligible=m=>{const d=doors[m.uuid]||doors[doorOwner(m,root)?.uuid];return !m.userData.abtDoorwayRoad&&!m.isSkinnedMesh&&!proxyOwner(m,root)&&!(d&&d.confirmed!==false)&&!m.userData.armaGlass&&!m.userData.armaSeat&&!m.userData.armaLadder&&!lights.some(l=>l.lampId===m.uuid||l.switchId===m.uuid);};
  plan=prepareBuildingVolumeCut(root,source,aperture,true,eligible);
  extras=openingParts(source,aperture,{window:true,glass,depth:axis});
  extras.traverse(m=>{if(m.userData.armaGlass){m.name=sceneName(root,'glass');m.userData.armaGlass.bulletproof=bulletproof;}});
  return {source,plan,extras,box:aperture};
 }catch(e){disposeFaceWindow({plan,extras});throw e;}finally{patch.remaining.dispose();patch.door.geometry.dispose();}
}
export function disposeFaceWindow(result){const geometries=new Set([result.plan?.geometry,...(result.plan?.changes||[]).map(c=>c.geometry)]);for(const g of geometries)g?.dispose();result.extras?.traverse(m=>{m.geometry?.dispose();m.material?.dispose();});}
export function applyFaceWindow(result){const {source,plan,extras}=result;if(plan.geometry)source.geometry=plan.geometry;for(const change of plan.changes){if(change.geometry)change.mesh.geometry=change.geometry;for(const [layer,shapes]of Object.entries(change.layers))setShapes(change.mesh,layer,shapes);}source.add(extras);source.updateWorldMatrix(true,true);return extras;}
export function installFaceWindow(api){
 const panel=document.createElement('details');panel.id='faceWindowTools';panel.dataset.noI18n='';
 panel.innerHTML='<summary></summary><label><span id="faceWindowDepthLabel"></span><input id="faceWindowDepth" type="number" value="0.3" min="0.005" max="1" step="0.01"></label><label><input id="faceWindowGlass" type="checkbox" checked><span id="faceWindowGlassLabel"></span></label><label><input id="faceWindowArmored" type="checkbox"><span id="faceWindowArmoredLabel"></span></label><p></p><button id="createFaceWindow" class="primary"></button>';
 document.getElementById('componentTools').append(panel);const $=id=>document.getElementById(id);
 const labels=()=>{panel.querySelector('summary').textContent=tr('Ventana desde caras seleccionadas','Window from selected faces');$('faceWindowDepthLabel').textContent=tr('Profundidad del hueco hacia dentro (m)','Opening depth inward (m)');$('faceWindowGlassLabel').textContent=tr('Añadir cristal','Add glass');$('faceWindowArmoredLabel').textContent=tr('Cristal blindado','Bulletproof glass');panel.querySelector('p').textContent=tr('Selecciona un rectángulo plano y vertical de una sola pared. La profundidad debe atravesarla. Abre las caras y colisiones, crea los cantos y añade un cristal separado. Sin marcar Añadir cristal crea solo el hueco. No añade Roadway.','Select a flat vertical rectangle on one wall. Depth must pass through it. Cuts faces and collision, creates reveals and adds separate glass. Uncheck Add glass for an empty opening. Does not add Roadway.');$('createFaceWindow').textContent=tr('Crear ventana desde caras','Create window from faces');};labels();onLanguage(labels);
 $('faceWindowGlass').onchange=()=>{$('faceWindowArmored').disabled=!$('faceWindowGlass').checked;};
 $('createFaceWindow').onclick=()=>{let result=null;try{if(!api.root())throw Error(tr('Importa un modelo primero.','Import a model first.'));api.close();result=prepareFaceWindow(api.root(),api.faces(),api.doors(),{depth:$('faceWindowDepth').valueAsNumber,glass:$('faceWindowGlass').checked,bulletproof:$('faceWindowArmored').checked});api.record(tr('Crear ventana desde caras','Create window from faces'));const extras=applyFaceWindow(result);result=null;api.refresh(extras);api.status(tr('Ventana creada con cantos y colisiones recortadas. Revisa que la profundidad atraviesa toda la pared. Ctrl + Z deshace.','Window created with reveals and cut collision. Check depth passes through the whole wall. Ctrl + Z undoes.'));}catch(e){if(result)disposeFaceWindow(result);api.status(e.message);}};
}


