import { defaultShape, setShapes, validateShape } from './layers.js';
import {surfaceShapes,usesExistingInterior} from './surface-collision.js';

// Apply the same positive axis scaling to every component: gaps remain gaps.
export function planRecalculation(mesh){
  mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;
  if(!box||box.isEmpty())return {mesh,layers:{},skipped:1};
  const layers={};let skipped=0;
  for(const layer of ['geometry','fire','view','roadway']){
    const plane=layer==='roadway';
    const shapes=mesh.userData.armaLayers?.[layer];
    // Automatic Roadway continues to use the actual upward faces, never a covering rectangle.
    if(shapes==null||mesh.userData.armaAutomaticLayers?.[layer]){layers[layer]={shapes:plane?null:usesExistingInterior(mesh)?surfaceShapes(mesh,()=>defaultShape(mesh)):[defaultShape(mesh)],automatic:true};continue;}
    if(!shapes.length){layers[layer]={shapes:[],automatic:false};continue;}
    const before=mesh.userData.armaLayerBounds?.[layer];
    if(!before){skipped++;continue;}
    const scale=before.min.map((v,i)=>{const old=before.max[i]-v,next=box.max.getComponent(i)-box.min.getComponent(i);return old>1e-9&&next>1e-9?next/old:plane&&Math.abs(old)<1e-9&&Math.abs(next)<1e-9?1:NaN;});
    const equal=scale.every(v=>Math.abs(v-scale[0])<1e-8);
    if(!scale.every(v=>Number.isFinite(v)&&v>0)||(!equal&&shapes.some(s=>s.rotation.some(v=>Math.abs(v)>1e-8)))){skipped++;continue;}
    const updated=shapes.map(s=>{validateShape(s,plane);return {...structuredClone(s),center:s.center.map((v,i)=>box.min.getComponent(i)+(v-before.min[i])*scale[i]),size:s.size.map((v,i)=>v*scale[i])};});
    layers[layer]={shapes:updated,automatic:false};
  }
  return {mesh,layers,skipped};
}
export function applyRecalculation(plans){for(const {mesh,layers} of plans)for(const [layer,value] of Object.entries(layers)){setShapes(mesh,layer,value.shapes);mesh.userData.armaAutomaticLayers[layer]=value.automatic;}}
export function installRecalculate(api){
  const panel=document.createElement('section');panel.innerHTML='<label for="recalculateScope">Recalcular geometrías</label><select id="recalculateScope"><option value="selection">Piezas seleccionadas</option><option value="all">Todo el edificio</option></select><button id="recalculateLayers">Recalcular conservando huecos</button><p class="hint">Colisión, disparos, visión IA y suelos. Las cajas y los suelos editados se adaptan proporcionalmente al tamaño de su pieza, manteniendo los huecos de puertas, ventanas y escaleras. Las capas sin referencia anterior o con giros incompatibles se conservan sin modificar. Los suelos automáticos usan las caras superiores del modelo. Memory no cambia.</p><p id="recalculateResult" role="status"></p>';
  document.getElementById('layerPanel').append(panel);
  document.getElementById('recalculateLayers').onclick=()=>{try{
    if(!api.root())throw new Error('Importa un modelo primero.');api.close();
    const objects=document.getElementById('recalculateScope').value==='all'?[api.root()]:api.selection(),meshes=new Set();for(const object of objects)object.traverse(m=>{if(m.isMesh)meshes.add(m);});
    if(!meshes.size)throw new Error('Selecciona piezas, caras o puntos, o elige todo el edificio.');
    const plans=[...meshes].map(planRecalculation),changed=plans.filter(p=>Object.keys(p.layers).length);
    if(changed.length){api.record('Recalcular geometrías');applyRecalculation(changed);api.refresh();}
    const skipped=plans.reduce((n,p)=>n+p.skipped,0),message=`Geometrías recalculadas en ${changed.length} piezas. ${skipped?`${skipped} capas conservadas sin adaptar: revisa su ajuste.`:'Huecos y capas vacías conservados.'} ${changed.length?'Ctrl + Z lo deshace.':''}`;
    document.getElementById('recalculateResult').textContent=message;api.status(message);
  }catch(e){document.getElementById('recalculateResult').textContent=e.message;api.status(e.message);}};
}
