import * as THREE from 'three';
import { modelMeshes, shapesFor, setShapes, shapeGeometry } from './layers.js';

export function generateShadows(meshes){
  // Independent closed boxes retain the openings already authored in collision.
  const plans=meshes.map(mesh=>[mesh,mesh.userData.armaGlass?[]:shapesFor(mesh,'geometry').map(s=>({...structuredClone(s),name:'Sombra',size:s.size.map(v=>v*.995)}))]);
  for(const [mesh,shapes] of plans)setShapes(mesh,'shadow',shapes);
  return plans.reduce((n,[,shapes])=>n+shapes.length*12,0);
}
export function installShadows(api){
  const panel=document.createElement('section');panel.innerHTML=`<div class="section-title">SOMBRAS</div><select id="shadowScope" aria-label="Generar sombras para"><option value="all">Todo el edificio</option><option value="selection">Piezas seleccionadas</option></select><button id="generateShadows">Generar / recalcular sombras</button><label><input id="previewShadows" type="checkbox" checked> Ver sombras proyectadas</label><label for="shadowSun">Dirección de la luz</label><input id="shadowSun" type="range" min="0" max="360" value="45"><button id="editShadows">Editar capa de sombras</button><p id="shadowSummary" class="hint"></p><p class="hint">Se generan volúmenes simplificados a partir de las cajas de colisión, conservando los huecos que hayas preparado. Revisa ventanas y elimina los volúmenes de cristales o detalles que no deban tapar la luz. Recalcular sustituye la sombra de las piezas elegidas. Ctrl + Z deshace. La iluminación del visor es orientativa.</p>`;
  document.getElementById('layerPanel').append(panel);
  const $=id=>document.getElementById(id),group=new THREE.Group();api.scene.add(group);
  const material=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false});
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShadowMaterial({opacity:.5}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;api.scene.add(ground);
  api.renderer.shadowMap.enabled=true;api.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  api.light.castShadow=true;api.light.shadow.mapSize.set(2048,2048);api.light.shadow.normalBias=.015;api.light.shadow.bias=-.0001;
  api.scene.add(api.light.target);
  let entries=new Map(),lastRoot=null;
  function remove(entry){for(const proxy of entry.proxies){group.remove(proxy);proxy.geometry.dispose();}}
  $('generateShadows').onclick=()=>{try{
    if(!api.root())throw new Error('Importa un modelo primero.');api.close();
    const selected=new Set();for(const o of api.selection())o.traverse(m=>{if(m.isMesh)selected.add(m);});
    const meshes=$('shadowScope').value==='all'?modelMeshes(api.root()):[...selected];
    if(!meshes.length)throw new Error('Selecciona las piezas para generar sus sombras.');
    api.record('Generar sombras');const faces=generateShadows(meshes);api.refresh();
    api.status(`Sombras generadas: ${faces} triángulos. Revisa la capa y prueba la apertura de las puertas. Ctrl + Z deshace.`);
  }catch(e){api.status(e.message);}};
  $('editShadows').onclick=()=>{$('layerMode').value='shadow';$('layerMode').dispatchEvent(new Event('change'));};
  return {update(){
    const root=api.root();if(root!==lastRoot){for(const e of entries.values())remove(e);entries.clear();lastRoot=root;}
    const enabled=!!root&&$('previewShadows').checked;
    group.visible=enabled;ground.visible=enabled;api.light.castShadow=enabled;
    if(!root)return;
    root.updateWorldMatrix(true,true);const live=new Set(),bounds=new THREE.Box3();let count=0;
    root.traverse(mesh=>{
      if(!mesh.isMesh)return;live.add(mesh);const shapes=mesh.userData.armaLayers?.shadow;
      let entry=entries.get(mesh);
      if(!entry||entry.shapes!==shapes){if(entry)remove(entry);entry={shapes,proxies:(shapes||[]).map(s=>{const proxy=new THREE.Mesh(shapeGeometry(s),material);proxy.matrixAutoUpdate=false;proxy.castShadow=true;group.add(proxy);return proxy;})};entries.set(mesh,entry);}
      let visible=!mesh.userData.armaGlass;for(let p=mesh;p;p=p.parent)if(!p.visible)visible=false;
      mesh.receiveShadow=enabled;
      for(const proxy of entry.proxies){proxy.visible=visible;proxy.matrix.copy(mesh.matrixWorld);proxy.updateMatrixWorld(true);if(visible){bounds.expandByObject(proxy);count+=12;}}
    });
    for(const [mesh,e] of entries)if(!live.has(mesh)){remove(e);entries.delete(mesh);}
    $('shadowSummary').textContent=count?`${count} triángulos de sombra. Las puertas proyectan su sombra al abrirse.`:'Sin sombras generadas.';
    if(bounds.isEmpty()){ground.visible=false;return;}
    const visualBounds=new THREE.Box3().setFromObject(root);bounds.union(visualBounds);
    const center=bounds.getCenter(new THREE.Vector3()),extent=Math.max(bounds.getSize(new THREE.Vector3()).length(),2),angle=THREE.MathUtils.degToRad(Number($('shadowSun').value));
    ground.position.set(center.x,visualBounds.min.y-.01,center.z);ground.scale.setScalar(extent*4);
    api.light.target.position.copy(center);api.light.position.copy(center).add(new THREE.Vector3(Math.cos(angle),1.5,Math.sin(angle)).multiplyScalar(extent));
    const camera=api.light.shadow.camera;camera.left=camera.bottom=-extent;camera.right=camera.top=extent;camera.near=.01;camera.far=extent*5;camera.updateProjectionMatrix();
  }};
}
