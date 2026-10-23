import * as T from 'three';
import {activeBounds,surfaceShapes} from './surface-collision.js';
import {defaultShape,shapesFor,setShapes,shapeGeometry,automaticRoadway,modelMeshes} from './layers.js';
import {getLanguage,onLanguage} from './i18n.js';
const tr=(es,en)=>getLanguage()==='en'?en:es;
const layers=['geometry','fire','view'];
function protectedPart(mesh,root,doors){for(let o=mesh;o;o=o.parent){if(o.userData.armaGlass||o.userData.armaProxy||doors[o.uuid]?.confirmed!==false&&doors[o.uuid])return true;if(o===root)break;}return false;}
function targets(root,selection){const all=new Set();for(const o of selection){if(root.getObjectByProperty('uuid',o.uuid)!==o)continue;o.traverse(m=>{if(m.isMesh)all.add(m);});}return [...all];}
export function optimizationStamp(root,meshes,doors){root.updateWorldMatrix(true,true);return JSON.stringify(meshes.map(m=>[m.uuid,root.getObjectByProperty('uuid',m.uuid)===m,m.geometry.uuid,m.geometry.attributes.position?.version,m.geometry.index?.version,m.geometry.drawRange,m.geometry.groups,[].concat(m.material).map(v=>v?.visible),m.matrixWorld.elements,m.visible,m.userData,protectedPart(m,root,doors)]));}
export function planBuildingOptimization(root,selection,mode,{doors={},roadway='auto'}={}){
 if(!['accessible','closed','visual'].includes(mode))throw Error('Invalid optimization mode');
 root.updateWorldMatrix(true,true);const selected=targets(root,selection);if(!selected.length)throw Error(tr('Selecciona las piezas que quieres clasificar.','Select the parts to classify.'));
 const protectedMeshes=selected.filter(m=>protectedPart(m,root,doors));
 if(mode==='closed'&&protectedMeshes.length)throw Error(tr('Un bloque cerrado no puede incluir puertas, cristales configurados o proxies. Selecciona solo el volumen cerrado.','A closed block cannot include doors, configured glass or proxies. Select only the closed volume.'));
 const meshes=selected.filter(m=>!protectedMeshes.includes(m));if(!meshes.length)throw Error(tr('La selección solo contiene piezas protegidas. Conservamos sus colisiones.','The selection only contains protected parts. Their collision is preserved.'));
 const rows=[];let combined;
 if(mode==='closed'){
  const anchor=meshes[0],inverse=anchor.matrixWorld.clone().invert(),bounds=new T.Box3();
  for(const m of meshes){const b=activeBounds(m),transform=inverse.clone().multiply(m.matrixWorld);if(b.isEmpty())continue;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])bounds.expandByPoint(new T.Vector3(x,y,z).applyMatrix4(transform));}
  if(bounds.isEmpty())throw Error(tr('No hay geometría válida.','No valid geometry.'));
  combined={name:tr('Bloque cerrado','Closed block'),center:bounds.getCenter(new T.Vector3()).toArray(),size:bounds.getSize(new T.Vector3()).max(new T.Vector3(.03,.03,.03)).toArray(),rotation:[0,0,0]};
 }
 for(const m of meshes){
  const shapes=mode==='visual'?[]:mode==='closed'?(m===meshes[0]?[combined]:[]):surfaceShapes(m,()=>defaultShape(m));
  const floor=mode==='accessible'&&(roadway==='yes'||roadway==='auto'&&(/floor|suelo|pavimento|stairs|steps|escalera|ramp|rellano/i.test(m.name)||m.userData.abtInteriorSurface==='floor'));
  rows.push({mesh:m,layers:{geometry:shapes,fire:shapes,view:shapes,roadway:floor?null:[]}});
 }
 const before=meshes.reduce((n,m)=>n+shapesFor(m,'geometry').length,0),after=rows.reduce((n,r)=>n+r.layers.geometry.length,0),others=modelMeshes(root).filter(m=>!meshes.includes(m)).reduce((n,m)=>n+shapesFor(m,'geometry').length,0);
 if(mode==='accessible'&&after+others>2048)throw Error(tr('La estructura superaría 2048 componentes. Marca primero los detalles como Solo visual y la torre como Bloque cerrado, o trabaja por zonas.','The structure would exceed 2048 components. First mark details as Visual only and the tower as Closed block, or work by zones.'));
 return {root,mode,rows,meshes,selected,before,after,total:after+others,protected:protectedMeshes.length,stamp:optimizationStamp(root,selected,doors)};
}
export function applyBuildingOptimization(plan,doors={}){
 if(optimizationStamp(plan.root,plan.selected,doors)!==plan.stamp)throw Error(tr('El modelo cambió. Revisa de nuevo la vista previa.','The model changed. Review the preview again.'));
 for(const row of plan.rows){for(const [layer,shapes] of Object.entries(row.layers))setShapes(row.mesh,layer,shapes);row.mesh.userData.abtOptimization={mode:plan.mode,version:1};}
}
export function installBuildingOptimizer(api){
 const host=document.getElementById('layerPanel'),panel=document.createElement('details');panel.id='buildingOptimizer';panel.dataset.noI18n='';host.prepend(panel);
 const overlay=new T.Group();overlay.name='OptimizationPreview';api.scene.add(overlay);let pending=null,lastCheck=0;
 function clear(){pending=null;for(const child of [...overlay.children]){child.geometry.dispose();child.material.dispose();overlay.remove(child);}const apply=panel.querySelector('#optimizeApply');if(apply)apply.disabled=true;}
 function render(){clear();panel.innerHTML=`<summary>${tr('Optimizar edificio grande','Optimize large building')}</summary><p>${tr('Selecciona piezas en el visor o en la lista. Se modifican sus capas de colisión, disparos, visión y suelos; el modelo visible se conserva.','Select parts in the viewport or list. Changes collision, fire, AI view and floor layers; the visible model is preserved.')}</p><select id="optimizeMode" aria-label="${tr('Uso de la selección','Selection use')}"><option value="accessible">${tr('Interior accesible','Accessible interior')}</option><option value="closed">${tr('Bloque cerrado · una caja','Closed block · one box')}</option><option value="visual">${tr('Solo visual · sin colisiones','Visual only · no collision')}</option></select><label id="optimizeRoadLabel">Roadway<select id="optimizeRoadway"><option value="auto">${tr('Suelos y escaleras por nombre','Floors and stairs by name')}</option><option value="yes">${tr('La selección es suelo o escalera','Selection is floor or stairs')}</option><option value="no">${tr('Sin suelo transitable','No walkable floor')}</option></select></label><p id="optimizeHelp"></p><button id="optimizePreview">${tr('Revisar vista previa','Review preview')}</button><button id="optimizeApply" class="primary" disabled>${tr('Aplicar clasificación','Apply classification')}</button><button id="optimizeCancel">${tr('Ocultar vista previa','Hide preview')}</button><p id="optimizeResult" role="status"></p>`;
  const $=id=>panel.querySelector('#'+id);
  function help(){clear();$('optimizeRoadLabel').hidden=$('optimizeMode').value!=='accessible';$('optimizeHelp').textContent=$('optimizeMode').value==='closed'?tr('Una caja engloba toda la selección: úsalo solo en zonas cerradas. La caja queda vinculada a la primera pieza; si separas o mueves las piezas después, vuelve a calcularla.','One box encloses the selection: use only for closed zones. The box follows the first part; recalculate if parts are moved separately.'):$('optimizeMode').value==='visual'?tr('No bloqueará jugadores, disparos ni visión de IA. Las puertas, cristales configurados y proxies quedan protegidos.','Will not block players, bullets or AI sight. Configured doors, glass and proxies are protected.'):tr('Respeta las superficies y huecos. Roadway automático reconoce suelos y escaleras por nombre: revisa las zonas verdes. Reemplaza también las capas manuales de estas piezas.','Follows surfaces and openings. Automatic Roadway recognizes named floors and stairs: check green areas. Also replaces manual layers of these parts.');}
  $('optimizeMode').onchange=help;$('optimizeRoadway').onchange=()=>clear();$('optimizeCancel').onclick=clear;help();
  $('optimizePreview').onclick=()=>{clear();try{const root=api.root();if(!root)throw Error(tr('Importa un modelo primero.','Import a model first.'));api.close();const plan=planBuildingOptimization(root,api.selection(),$('optimizeMode').value,{doors:api.doors(),roadway:$('optimizeRoadway').value});
   function add(mesh,g,color){const line=new T.LineSegments(new T.WireframeGeometry(g),new T.LineBasicMaterial({color,depthTest:false,transparent:true,opacity:.65}));g.dispose();line.matrixAutoUpdate=false;line.matrix.copy(mesh.matrixWorld);line.raycast=()=>{};overlay.add(line);}
   for(const row of plan.rows){for(const s of row.layers.geometry)add(row.mesh,shapeGeometry(s),0x34cce4);if(row.layers.roadway===null)add(row.mesh,automaticRoadway(row.mesh),0x63e399);if(plan.mode==='visual'){const g=new T.BoxGeometry(...defaultShape(row.mesh).size);g.translate(...defaultShape(row.mesh).center);add(row.mesh,g,0xffb454);}}
   pending=plan;$('optimizeResult').textContent=tr(`${plan.meshes.length} piezas: ${plan.before} → ${plan.after} componentes de colisión. Total del modelo: ${plan.total}. Protegidas: ${plan.protected}. Cian: colisión; verde: Roadway; naranja: sin colisión.`,`${plan.meshes.length} parts: ${plan.before} → ${plan.after} collision components. Model total: ${plan.total}. Protected: ${plan.protected}. Cyan: collision; green: Roadway; orange: no collision.`);$('optimizeApply').disabled=false;
  }catch(e){clear();$('optimizeResult').textContent=e.message;}};
  $('optimizeApply').onclick=()=>{try{if(!pending||pending.root!==api.root())throw Error(tr('Revisa la vista previa otra vez.','Review the preview again.'));if(optimizationStamp(pending.root,pending.selected,api.doors())!==pending.stamp)throw Error(tr('El modelo cambió. Revisa de nuevo.','Model changed. Review again.'));api.record(tr('Optimizar edificio grande','Optimize large building'));applyBuildingOptimization(pending,api.doors());clear();api.refresh();$('optimizeResult').textContent=tr('Aplicado. Ctrl + Z deshace. Revisa Colisión y Suelos antes de exportar.','Applied. Ctrl + Z undoes. Review Collision and Floors before export.');api.status($('optimizeResult').textContent);}catch(e){clear();$('optimizeResult').textContent=e.message;}};
 }
 render();onLanguage(render);panel.addEventListener('toggle',()=>{if(!panel.open)clear();});
 return {clear,update(){if(!pending||performance.now()-lastCheck<400)return;lastCheck=performance.now();if(pending.root!==api.root()||host.closest('[hidden]')||optimizationStamp(pending.root,pending.selected,api.doors())!==pending.stamp)clear();}};
}
