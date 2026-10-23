import * as T from 'three';
import {surfaceShapes} from './surface-collision.js';
import {defaultShape,setShapes} from './layers.js';
import {doorOwner} from './selection.js';
import {getLanguage,onLanguage} from './i18n.js';
const tr=(es,en)=>getLanguage()==='en'?en:es;
export function planExistingInterior(root,doors={},included=null){
 root.updateWorldMatrix(true,true);const meshes=[];root.traverse(m=>{if(m.isMesh&&!m.userData.abtDoorwayRoad)meshes.push(m);});
 const isWall=m=>/room.*wall|interior.*wall|wall.*interior|pared.*interior/i.test(m.name);
 const isFloor=m=>/floor|suelo|pavimento/i.test(m.name);
 const isStairs=m=>/stairs|steps|ramp|escalera/i.test(m.name);
 const isCeiling=m=>/ceil+ing|ceilling|techo.*interior/i.test(m.name);
 // Named structural sets are a hint, never silently remove unrelated collision layers.
 const recognized=meshes.some(isWall)&&meshes.some(isFloor)&&meshes.some(isCeiling);
 const plans=[];let components=0,excluded=0,preserved=0;
 for(const mesh of meshes){
  const owner=doorOwner(mesh,root),d=doors[owner?.uuid]||doors[mesh.uuid],moving=d&&d.confirmed!==false,pane=!!mesh.userData.armaGlass;
  const structure=included?included.has(mesh.uuid):!recognized||isWall(mesh)||isFloor(mesh)||isCeiling(mesh)||isStairs(mesh);
  const keep=structure||moving||pane;
  let generated=null;const layers={};
  for(const layer of ['geometry','fire','view']){
   if(mesh.userData.armaLayers?.[layer]!==undefined&&!mesh.userData.armaAutomaticLayers?.[layer]&&!mesh.userData.armaExistingInteriorLayers?.[layer]){preserved++;continue;}
   if(!keep){layers[layer]=[];continue;}
   generated??=moving||pane?[defaultShape(mesh)]:surfaceShapes(mesh,()=>defaultShape(mesh));layers[layer]=layer==='view'&&pane?[]:generated;
  }
  if(mesh.userData.armaLayers?.roadway===undefined||mesh.userData.armaAutomaticLayers?.roadway||mesh.userData.armaExistingInteriorLayers?.roadway)layers.roadway=(!moving&&!pane&&(!recognized||isFloor(mesh)||isStairs(mesh)))?null:[];
  const count=layers.geometry?.length??mesh.userData.armaLayers?.geometry?.length??0;components+=count;
  if(!keep)excluded++;plans.push({mesh,layers,included:keep});
 }
 if(components>2048)throw Error(tr('La estructura genera demasiados componentes. Separa o simplifica los detalles; no se ha cambiado el modelo.','The structure produces too many components. Separate or simplify details; the model was not changed.'));
 return {plans,components,excluded,preserved,recognized};
}
export function applyExistingInterior(root,plan){
 for(const {mesh,layers} of plan.plans)for(const [layer,shapes] of Object.entries(layers)){setShapes(mesh,layer,shapes);mesh.userData.armaAutomaticLayers[layer]=false;mesh.userData.armaExistingInteriorLayers??={};mesh.userData.armaExistingInteriorLayers[layer]=true;}
 root.userData.armaInteriorMode='existing';
}
export function installExistingInterior(api){
 const host=document.getElementById('layerPanel');
 const section=document.createElement('section');section.id='existingPhysicsPanel';section.dataset.noI18n='';host.prepend(section);
 function labels(){section.innerHTML=`<h3>${tr('Generar físicas desde el modelo','Generate physics from the model')}</h3><p>${tr('Prepara colisiones y suelos usando la estructura existente. No crea habitaciones ni recorta el modelo. Las capas editadas a mano se conservan.','Build collision and floors from the existing structure. Does not create rooms or cut the model. Manually edited layers are preserved.')}</p><p>${tr('Si reconoce paredes interiores, suelo y techo por sus nombres, utiliza ese conjunto y deja los detalles exteriores sin colisión. Revisa la lista de piezas antes de aplicar.','When interior walls, floor and ceiling are recognized by name, that structural set is used and exterior details are excluded from collision. Review the parts list before applying.')}</p><button id="existingInspect">${tr('Analizar estructura','Analyze structure')}</button><button class="primary" id="existingApply" disabled>${tr('Aplicar colisiones y Roadway','Apply collision and Roadway')}</button><p id="existingResult" role="status"></p><details><summary>${tr("Piezas que tendrán colisión","Parts with collision")}</summary><div id="existingParts"></div></details>`;bind();}
 let pending=null;const $=id=>document.getElementById(id);
 function bind(){pending=null;$('existingInspect').onclick=()=>{try{const root=api.root();if(!root)throw Error(tr('Importa un modelo primero.','Import a model first.'));api.close();pending={root,plan:planExistingInterior(root,api.doors())};const p=pending.plan;$('existingResult').textContent=tr(`Estructura: ${p.components} componentes. ${p.excluded} piezas fuera del conjunto detectado; ${p.preserved} capas manuales conservadas.`,`Structure: ${p.components} components. ${p.excluded} parts outside the detected set; ${p.preserved} manual layers preserved.`);const list=$('existingParts');list.replaceChildren();for(const row of p.plans){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=row.included;check.dataset.mesh=row.mesh.uuid;label.append(check,document.createTextNode(row.mesh.name||row.mesh.uuid));list.append(label);}$('existingApply').disabled=false;}catch(e){pending=null;$('existingApply').disabled=true;$('existingResult').textContent=e.message;}};
 $('existingApply').onclick=()=>{try{if(!pending||pending.root!==api.root())throw Error(tr('Analiza de nuevo el modelo.','Analyze the model again.'));const selected=new Set([...$("existingParts").querySelectorAll("input:checked")].map(e=>e.dataset.mesh));const plan=planExistingInterior(api.root(),api.doors(),selected);api.record('Generar físicas desde el modelo');applyExistingInterior(api.root(),plan);pending=null;api.refresh();$('existingApply').disabled=true;api.status(tr('Físicas generadas. Revisa Colisión y Suelos antes de exportar. Ctrl + Z deshace.','Physics generated. Review Collision and Floors before exporting. Ctrl + Z undoes.'));}catch(e){api.status(e.message);}};}
 labels();onLanguage(labels);
}

