import {collectLadders} from '../ladders.js';
import {collectSeats} from '../seats.js';
import {proxyOwner,extractProxies} from './proxy-export.js';
import {validateFurniture} from '../furniture.js';
import { withExportVisibility } from '../scene-organization.js';
import { readLights, lightName } from '../lighting-data.js';
import { libraryResources } from '../material-library.js';
import { glassAtlasUV, appendGlassBack } from './glass-surface.js';
import * as THREE from 'three';
import { configs, validateOptions } from './config.js';
import { lod, selectRange, writeMlod } from './mlod.js';
import { doorOwner } from '../selection.js';
import { validateLight } from '../lights.js';
import { collectGlass, encodeGlass, glassHitPoints, moveGlassTop, glassFireShape } from '../glass.js';
import { cleanGlassTexture } from './glass-config.js';
import { tintPixels } from './texture-color.js';
import { shapesFor, shapeGeometry, validateMemory } from '../layers.js';
import {upwardTriangle} from '../surface-collision.js';

const range=(a,b)=>Array.from({length:b-a},(_,i)=>a+i);
const convert=(p,scale)=>[p.x*scale,p.y*scale,-p.z*scale];
function texturePng(texture,material){
  const image=texture.image;
  if(!image||!image.width||!image.height)throw new Error('Hay una textura sin imagen disponible.');
  const canvas=document.createElement('canvas');
  canvas.width=Math.min(2048,2**Math.ceil(Math.log2(image.width)));
  canvas.height=Math.min(2048,2**Math.ceil(Math.log2(image.height)));
  const context=canvas.getContext('2d');context.drawImage(image,0,0,canvas.width,canvas.height);
  const color=material.color||new THREE.Color('white'),opacity=material.transparent?material.opacity:1;
  if(color.r!==1||color.g!==1||color.b!==1||opacity!==1){const pixels=context.getImageData(0,0,canvas.width,canvas.height);tintPixels(pixels.data,color,opacity);context.putImageData(pixels,0,0);}
  return canvas.toDataURL('image/png').split(',')[1];
}
function exportVisibleModel(root,doorSettings,options,{encodeTexture=texturePng,encodeGlassTexture=encodeGlass}={}){
  const o=validateOptions(options);root.updateWorldMatrix(true,true);
  const confirmed=Object.entries(doorSettings).filter(([id,d])=>d.confirmed!==false&&root.getObjectByProperty('uuid',id));
  if(confirmed.length>60)throw new Error('Esta versión admite hasta 60 puertas por edificio.');
  const doors=confirmed.map(([id,d],i)=>({...d,id,label:root.getObjectByProperty('uuid',id).name||`Puerta ${i+1}`,selection:`door_${i+1}`}));
  for(const d of doors)if(d.switchId&&!root.getObjectByProperty('uuid',d.switchId))throw Error('Falta el objeto del interruptor de la puerta '+d.label);
  const byId=new Map(doors.map(d=>[d.id,d]));
  const lights=readLights(root).map(d=>validateLight(root,d,doorSettings));
  if(lights.length>32)throw Error('Máximo de 32 luces.');
  if(new Set(lights.map(d=>d.lampId)).size!==lights.length)throw Error('Una pieza está asignada a más de una luz.');
  for(const d of lights){const first=lights.find(l=>l.switchId===d.switchId);if(first.initialOn!==d.initialOn)throw Error('Las luces del mismo interruptor deben compartir el estado inicial.');}
  const panes=collectGlass(root,doorSettings),glassById=new Map(panes.map(g=>[g.mesh.uuid,g]));
  if(panes.length&&!o.collision)throw Error('Activa las colisiones para exportar cristales rompibles.');
  const ladders=collectLadders(root,doorSettings);
  const seats=collectSeats(root,doorSettings);
  const cfg=configs(o,doors,lights,panes,ladders,seats),visual=lod(0),geometry=lod(1e13),memory=lod(1e15),roadway=lod(3e15),fire=lod(7e15),view=lod(6e15),hitpoints=lod(5e15);
  const shadow=lod(10000);shadow.sharpEdges=true;
  const textures=[],materials=new Map(),libraryFiles=new Map();let component=0;
  const proxyGroups=new Map();
  const warnings=['Las capas editadas se exportan por separado. Las piezas sin revisar conservan cajas automáticas que pueden tapar huecos.','La conversión de materiales conserva color/textura base; no reproduce todos los mapas PBR.'];
  const counts={geometry:0,fire:0,view:0};
  function appendShape(target,mesh,shape,plane,names){
    const g=shapeGeometry(shape,plane),p=g.attributes.position,n=g.attributes.normal,index=g.index;
    const start=target.points.length,faceStart=target.faces.length,normalStart=target.normals.length,unique=new Map(),ids=[];
    const nm=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    for(let i=0;i<p.count;i++){
      const position=convert(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld),o.scale),key=position.join(',');
      if(!unique.has(key)){unique.set(key,target.points.length);target.points.push(position);}ids.push(unique.get(key));
      const normal=new THREE.Vector3().fromBufferAttribute(n,i).applyNormalMatrix(nm);target.normals.push([-normal.x,-normal.y,normal.z]);
    }
    // MLOD uses clockwise faces. Mirroring Z already changes Three's CCW
    // winding; reverse only for a further reflection in the mesh transform.
    for(let i=0;i<index.count;i+=3){const order=mesh.matrixWorld.determinant()<0?[2,1,0]:[0,1,2],vertices=order.map(j=>index.getX(i+j));target.faces.push({points:vertices.map(v=>ids[v]),normals:vertices.map(v=>normalStart+v)});}
    for(const name of names.filter(Boolean))selectRange(target,name,range(start,target.points.length),range(faceStart,target.faces.length));
    g.dispose();
  }
  function materialInfo(material){
    if(materials.has(material))return materials.get(material);
    if(material.userData.armaLibrary){const info=libraryResources(material.userData.armaLibrary,o.id);for(const f of info.files){if(libraryFiles.has(f.name)&&libraryFiles.get(f.name).data!==f.data)throw Error('Dos versiones distintas del mismo material en el proyecto. Reaplica el material desde la biblioteca.');libraryFiles.set(f.name,f);}materials.set(material,info);return info;}
    const color=material.color||new THREE.Color('white');const a=material.opacity??1;
    const info={texture:`#(argb,8,8,3)color(${color.r.toFixed(4)},${color.g.toFixed(4)},${color.b.toFixed(4)},${a.toFixed(4)},${a<1?'ca':'co'})`,material:''};
    if(material.map){
      if(material.map.isCompressedTexture)throw new Error('Exporta las texturas comprimidas de nuevo como PNG/JPG antes de crear el addon.');
      const name=`texture_${textures.length+1}_${material.transparent||material.alphaTest>0?'ca':'co'}`;
      textures.push({name,png:encodeTexture(material.map,material)});info.texture=`${o.id}\\data\\${name}.paa`;
    }
    materials.set(material,info);return info;
  }
  root.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.visible)return;
    for(let p=mesh.parent;p&&p!==root;p=p.parent)if(!p.visible)return;
    if(mesh.isSkinnedMesh||mesh.isInstancedMesh)throw new Error('Convierte los objetos con esqueleto o instancias a mallas estáticas antes de exportar.');
    const lightIndex=lights.findIndex(l=>l.lampId===mesh.uuid),light=lights[lightIndex];
    const pane=glassById.get(mesh.uuid),glassName=pane?`Glass_${pane.id}_hide`:null;
    const g=mesh.geometry,positions=g.attributes.position;if(!positions)return;
    if(!g.attributes.normal)g.computeVertexNormals();
    const normals=g.attributes.normal,uv=g.attributes.uv,index=g.index,base=visual.points.length,normalBase=visual.normals.length,faceStart=visual.faces.length;
    if(pane&&!uv)throw Error('El cristal «'+mesh.name+'» necesita coordenadas UV para la textura de grietas.');
    const normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld),meshMaterials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    const owner=doorOwner(mesh,root),door=byId.get(owner?.uuid)||byId.get(mesh.uuid);
    const furniture=proxyOwner(mesh,root);
    if(furniture&&!proxyGroups.has(furniture)){validateFurniture(root,furniture,doorSettings);proxyGroups.set(furniture,[]);}
    for(let i=0;i<positions.count;i++){
      const p=convert(new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld),o.scale);
      if(!p.every(Number.isFinite))throw new Error('Coordenadas no válidas en '+mesh.name);
      visual.points.push(p);
      const n=new THREE.Vector3().fromBufferAttribute(normals,i).applyNormalMatrix(normalMatrix);visual.normals.push([-n.x,-n.y,n.z]);
    }
    const count=index?index.count:positions.count;
    if(visual.points.length>300000||visual.faces.length+count/3>100000)throw new Error('Modelo demasiado denso para esta exportación: reduce el modelo a menos de 100.000 triángulos y 300.000 vértices.');
    for(let i=Math.max(0,g.drawRange.start);i+2<Math.min(count,g.drawRange.start+g.drawRange.count);i+=3){
      const materialIndex=g.groups.find(group=>i>=group.start&&i<group.start+group.count)?.materialIndex||0;
      const mat=meshMaterials[materialIndex]||meshMaterials[0];if(!mat||mat.visible===false)continue;
      const info=pane?{texture:cleanGlassTexture,material:`${o.id}\\data\\glass.rvmat`,glassOrder:pane.id}:materialInfo(mat),order=mesh.matrixWorld.determinant()<0?[2,1,0]:[0,1,2];
      const ids=order.map(j=>index?index.getX(i+j):i+j);
      const face={points:ids.map(v=>v+base),normals:ids.map(v=>v+normalBase),uv:ids.map(v=>{
        const t=uv?new THREE.Vector2().fromBufferAttribute(uv,v):new THREE.Vector2();
        if(mat.map&&!pane){mat.map.updateMatrix();t.applyMatrix3(mat.map.matrix);if(mat.map.flipY)t.y=1-t.y;}
        return pane?glassAtlasUV(t.x,t.y):[t.x,t.y];
      }),...info};if(mesh.uuid===light?.lampId)face.material=`${o.id}\\data\\${lightName('light',lightIndex)}_${light.initialOn?'on':'off'}.rvmat`;visual.faces.push(face);
      if(pane)appendGlassBack(visual,face);
      if(o.roadway&&!door&&!pane&&shapesFor(mesh,'roadway')===null){
        const n=new THREE.Vector3().fromBufferAttribute(normals,ids[0]).applyNormalMatrix(normalMatrix);
        const originalIds=[0,1,2].map(j=>index?index.getX(i+j):i+j);
        if(upwardTriangle(mesh,originalIds))roadway.faces.push({...face,texture:'',material:''});
      }
    }
    if(door)selectRange(visual,door.selection,range(base,visual.points.length),range(faceStart,visual.faces.length));
    if(mesh.uuid===light?.lampId)selectRange(visual,lightName('abt_lamp',lightIndex),range(base,visual.points.length),range(faceStart,visual.faces.length));
    if(pane){selectRange(visual,glassName,range(base,visual.points.length),range(faceStart,visual.faces.length));const start=hitpoints.points.length;hitpoints.points.push(...glassHitPoints(mesh,o.scale));selectRange(hitpoints,`Glass_${pane.id}`,range(start,hitpoints.points.length),[]);if(!shapesFor(mesh,'fire').length)throw Error('El cristal necesita geometría de disparos para recibir daño.');}
    if(o.collision)for(const [layer,target] of [['geometry',geometry],['view',view],['fire',fire]]){
      if(pane&&layer==='view')continue;const first=target.faces.length;
      for(const shape of shapesFor(mesh,layer))appendShape(target,mesh,pane&&layer==='fire'?glassFireShape(mesh,shape,o.scale):shape,false,[`Component${String(++counts[layer]).padStart(2,'0')}`,door?.selection,glassName]);
      if(pane&&layer==='fire')for(const f of target.faces.slice(first))f.material=`${o.id}\\data\\${pane.bulletproof?'glass_armored':'glass_fire'}.rvmat`;
    }
    if(!pane)for(const shape of shapesFor(mesh,'shadow'))appendShape(shadow,mesh,shape,false,[door?.selection]);
    if(furniture)proxyGroups.get(furniture).push(...range(faceStart,visual.faces.length));
  });
  // Automatic floor faces refer to visual vertices; explicit patches are appended afterwards.
  if(o.roadway){
    roadway.points=[...visual.points];roadway.normals=[...visual.normals];
    root.traverse(mesh=>{
      if(!mesh.isMesh||!mesh.visible||glassById.has(mesh.uuid))return;for(let p=mesh.parent;p&&p!==root;p=p.parent)if(!p.visible)return;
      const owner=doorOwner(mesh,root);if(byId.has(owner?.uuid)||byId.has(mesh.uuid))return;
      for(const shape of shapesFor(mesh,'roadway')||[])appendShape(roadway,mesh,shape,true,[]);
    });
  }
  if(!visual.faces.length)throw new Error('No hay caras visibles para exportar.');
  for(const d of doors)if(!visual.selections[d.selection]?.faces.size)throw new Error('La puerta «'+d.label+'» no tiene caras visibles.');
  for(const pane of panes)if(!visual.selections[`Glass_${pane.id}_hide`]?.faces.size)throw Error('Cristal sin caras visibles.');
  for(const d of doors){
    const object=root.getObjectByProperty('uuid',d.id),center=d.trigger?new THREE.Vector3().fromArray(d.trigger):new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
    if(!center.toArray().every(Number.isFinite))throw new Error('Punto de interacción inválido.');
    const p=new THREE.Vector3().fromArray(d.pivot),end=p.clone().addScaledVector(new THREE.Vector3().fromArray(d.motion==='translation'?d.slide:(d.direction||[0,1,0])).normalize(),d.motion==='translation'?1:d.height);
    const start=memory.points.length;memory.points.push(convert(p,o.scale),convert(end,o.scale),convert(center,o.scale));
    selectRange(memory,d.selection+'_axis',[start,start+1],[]);selectRange(memory,d.selection+'_trigger',[start+2],[]);
  }
  for(const ladder of ladders)for(const point of ['start','end']){const i=memory.points.length;memory.points.push(convert(ladder[point],o.scale));selectRange(memory,ladder.name+'_'+point,[i],[]);}
  for(const seat of seats)for(const point of ['position','exit']){const i=memory.points.length;memory.points.push(convert(seat[point],o.scale));selectRange(memory,seat.name+(point==='exit'?'_exit':''),[i],[]);}
  const extra=root.userData.armaMemory||[];validateMemory(extra);
  for(const [lightIndex,light] of lights.entries()){
    if(!visual.selections[lightName('abt_lamp',lightIndex)]?.faces.size)throw new Error('La lámpara no tiene caras visibles.');
    const points=[['abt_light_pos',light.position],['abt_light_switch',light.switchPosition]];
    if(light.type==='spot')points.push(['abt_light_dir',new THREE.Vector3(...light.position).add(spotDirection(light)).toArray()]);
    for(const [name,point] of points){const i=memory.points.length;memory.points.push(convert(new THREE.Vector3(...point).applyMatrix4(root.matrixWorld),o.scale));selectRange(memory,lightName(name,lightIndex),[i],[]);}
  }
  for(const p of extra){const index=memory.points.length;memory.points.push(convert(new THREE.Vector3(...p.position).applyMatrix4(root.matrixWorld),o.scale));selectRange(memory,p.name,[index],[]);}
  const proxies=extractProxies(visual,proxyGroups,o.id,o.scale),mainVisual=proxies.visual;
  moveGlassTop(mainVisual);
  const lods=[mainVisual];if(panes.length)lods.push(hitpoints);
  if(shadow.faces.length){
    mainVisual.properties.LODNoShadow='1';lods.push(shadow);
    if(shadow.faces.length>1000)warnings.push(`Sombra de ${shadow.faces.length} triángulos: revisa su complejidad y rendimiento en Arma; puedes eliminar detalles en la capa Sombras.`);
  }else warnings.push('Sin sombras generadas. Usa Generar / recalcular sombras antes de exportar.');
  if(o.collision){
    geometry.mass=geometry.points.map(()=>20000/geometry.points.length);geometry.properties={class:'house',map:'house'};lods.push(geometry);
    if(shadow.faces.length)Object.assign(geometry.properties,{prefershadowvolume:'1'});
    lods.push(view,fire);component=counts.geometry;
  }
  lods.push(memory);
  if(roadway.faces.length)lods.push(roadway);
  if(!o.collision)warnings.push('Sin LOD Geometry: el objeto no bloqueará el paso.');
  if(!o.roadway)warnings.push('Sin LOD Roadway: no se preparan superficies para caminar.');
  return {id:o.id,label:o.label,model:cfg.model,p3d:writeMlod(lods),proxyModels:proxies.models,config:cfg.config,modelCfg:cfg.modelCfg,mod:cfg.mod,assets:cfg.assets,libraryFiles:[...libraryFiles.values()],textures,warnings,stats:{faces:mainVisual.faces.length,proxies:proxies.instances,proxyModels:proxies.models.length,doors:doors.length,ladders:ladders.length,seats:seats.length,lights:lights.length,windows:panes.length,lods:lods.length,components:component,shadowFaces:shadow.faces.length}};
}

export function exportModel(root,doors,options,encoding){return withExportVisibility(root,()=>exportVisibleModel(root,doors,options,encoding));}
import {spotDirection} from '../spotlight.js';
