import {t} from '../i18n.js';
import {modelMeshes,validateMemory,validateShape} from '../layers.js';
import {collectLadders} from '../ladders.js';
import {collectSeats} from '../seats.js';
import {validateDoorMotion} from '../door-motion.js';
import {readLights} from '../lighting-data.js';
import {validateLight} from '../lights.js';
import {collectGlass} from '../glass.js';
import {withExportVisibility} from '../scene-organization.js';

// Conservative structural checks. Intersection and playability need an in-game test.
export function reviewModel(root,doors,options,language='es'){
  const issues=[],tr=(es,en)=>language==='en'?en:es;
  const add=(level,object,message)=>issues.push({level,object,message});
  const check=(name,fn)=>{try{fn();}catch(error){add('error',name,t(error.message));}};
  if(!root){add('error','',tr('Importa un modelo.','Import a model.'));return issues;}
  return withExportVisibility(root,()=>{
    root.updateWorldMatrix(true,true);
    check('Memory',()=>validateMemory(root.userData.armaMemory||[]));
    check(tr('Escaleras','Ladders'),()=>{
      for(const ladder of collectLadders(root,doors)){
        const drift=Math.hypot(ladder.end.x-ladder.start.x,ladder.end.z-ladder.start.z)* (options.scale??1);
        if(drift>.05)add('warning',ladder.mesh.name,tr('La subida se desplaza horizontalmente '+drift.toFixed(2)+' m. Para una escalera vertical, usa Alinear subida vertical.','Climbing drifts horizontally by '+drift.toFixed(2)+' m. For an upright ladder, use Align vertical climb.'));
      }
    });
    check(tr('Cristales','Glass'),()=>collectGlass(root,doors));
    check(tr('Asientos','Seats'),()=>{for(const seat of collectSeats(root,doors))add('warning',seat.mesh.name,tr('Prueba la altura, orientación y salida del asiento en Arma.','Test seat height, heading and exit in Arma.'));});
    readLights(root).forEach(l=>check(l.name,()=>validateLight(root,l,doors)));
    for(const [id,d] of Object.entries(doors)){
      if(d.confirmed===false)continue;
      const mesh=root.getObjectByProperty('uuid',id);
      if(!mesh){add('error',id,tr('Falta la pieza de la puerta.','Door object is missing.'));continue;}
      check(mesh.name,()=>{validateDoorMotion(d);if(!Array.isArray(d.pivot)||d.pivot.length!==3||!d.pivot.every(Number.isFinite)||!Number.isFinite(d.height)||d.height<=0)throw Error(tr('Eje Memory inválido.','Invalid Memory axis.'));});
    }
    for(const mesh of modelMeshes(root)){
      let visible=true;for(let p=mesh;p;p=p.parent)if(!p.visible)visible=false;if(!visible)continue;
      const name=mesh.name||mesh.uuid;
      const p=mesh.geometry?.attributes.position;
      if(!p||Array.from(p.array).some(v=>!Number.isFinite(v)))add('error',name,tr('Vértices ausentes o inválidos.','Missing or invalid vertices.'));
      for(const [layer,shapes] of Object.entries(mesh.userData.armaLayers||{}))if(Array.isArray(shapes))check(name+' · '+layer,()=>shapes.forEach(s=>validateShape(s,layer==='roadway')));
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      for(const m of materials){
        if(!m){add('error',name,tr('Material ausente.','Missing material.'));continue;}
        if(m.map&&!mesh.geometry.attributes.uv)add('warning',name,tr('La textura no tiene coordenadas UV.','Texture has no UV coordinates.'));
        if(m.map&&!m.userData?.armaLibrary&&!m.map.image)add('error',name,tr('No se encuentra la imagen de la textura.','Texture image is missing.'));
      }
      if(options.collision&&mesh.userData.armaLayers?.geometry===undefined)add('warning',name,tr('Colisión automática: revisa huecos y zonas de paso.','Automatic collision: check openings and passageways.'));
      if(mesh.userData.armaLadder)add('warning',name,tr('Prueba el lado de acceso y la salida superior en Arma.','Test the access side and upper exit in Arma.'));
    }
    if(!options.collision)add('warning','Geometry',tr('Colisiones desactivadas.','Collisions disabled.'));
    return issues;
  });
}
