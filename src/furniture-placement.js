import * as THREE from 'three';
import {topObjects,transformObjects,transformAxis} from './editing.js';
import {furnitureRoot,validateFurniture,duplicateFurniture} from './furniture.js';
import {getLanguage,onLanguage} from './i18n.js';
const tr=(es,en)=>getLanguage()==='en'?en:es;
export function placementTargets(root,selection,doors={}){
  if(!root||!selection.length)throw Error(tr('Selecciona un mueble.','Select furniture.'));
  const objects=topObjects([...new Set(selection.map(o=>furnitureRoot(o,root)))]);
  objects.forEach(o=>validateFurniture(root,o,doors));root.updateWorldMatrix(true,true);return objects;
}
export function applyPlacement(plans,doors={}){
  for(const {object,delta} of plans){
    object.updateWorldMatrix(true,true);
    transformObjects([{object,world:object.matrixWorld.clone()}],delta);
    object.traverse(o=>{if(doors[o.uuid])doors[o.uuid]=transformAxis(doors[o.uuid],delta);});
  }
}
export function gridPlacement(objects,step){
  if(!Number.isFinite(step)||step<=0)throw Error(tr('Paso de cuadrícula inválido.','Invalid grid step.'));
  return objects.map(object=>{
    const c=new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
    return {object,delta:new THREE.Matrix4().makeTranslation(Math.round(c.x/step)*step-c.x,0,Math.round(c.z/step)*step-c.z)};
  });
}
export function rotatePlacement(objects,degrees){
  if(!Number.isFinite(degrees))throw Error('Invalid angle');
  return objects.map(object=>{
    const c=new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
    return {object,delta:new THREE.Matrix4().makeTranslation(c.x,c.y,c.z).multiply(new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(degrees))).multiply(new THREE.Matrix4().makeTranslation(-c.x,-c.y,-c.z))};
  });
}
export function floorPlacement(root,objects){
  root.updateWorldMatrix(true,true);const excluded=new Set(),surfaces=[];
  objects.forEach(o=>o.traverse(c=>excluded.add(c)));
  root.traverse(mesh=>{
    if(!mesh.isMesh||excluded.has(mesh))return;
    for(let p=mesh;p;p=p.parent)if(!p.visible)return;
    const g=mesh.geometry,p=g.attributes.position;if(!p)return;
    const index=g.index,count=index?.count??p.count;
    for(let i=Math.max(0,g.drawRange.start);i+2<Math.min(count,g.drawRange.start+g.drawRange.count);i+=3){
      const mi=g.groups.find(group=>i>=group.start&&i<group.start+group.count)?.materialIndex||0;
      const mat=Array.isArray(mesh.material)?mesh.material[mi]:mesh.material;if(mat?.visible===false)continue;
      const vertices=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));
      const normal=new THREE.Vector3().subVectors(vertices[1],vertices[0]).cross(new THREE.Vector3().subVectors(vertices[2],vertices[0])).normalize();
      if(Math.abs(normal.y)>.5)surfaces.push(vertices);
    }
  });
  return objects.map(object=>{
    const box=new THREE.Box3().setFromObject(object),c=box.getCenter(new THREE.Vector3()),dx=(box.max.x-box.min.x)*.4,dz=(box.max.z-box.min.z)*.4;
    let height=-Infinity;
    for(const [x,z] of [[c.x,c.z],[c.x-dx,c.z-dz],[c.x+dx,c.z-dz],[c.x-dx,c.z+dz],[c.x+dx,c.z+dz]]){
      const ray=new THREE.Ray(new THREE.Vector3(x,box.min.y+.02,z),new THREE.Vector3(0,-1,0)),hit=new THREE.Vector3();
      for(const tri of surfaces)if(ray.intersectTriangle(...tri,false,hit))height=Math.max(height,hit.y);
    }
    if(!Number.isFinite(height)&&box.min.y>=0)height=0;
    if(!Number.isFinite(height))throw Error(tr('No hay suelo debajo de ','No floor below ')+object.name);
    return {object,delta:new THREE.Matrix4().makeTranslation(0,height-box.min.y,0)};
  });
}
export function duplicateRow(root,source,doors,count,spacing,axis){
  if(!Number.isInteger(count)||count<1||count>50||!Number.isFinite(spacing)||spacing<=0||!['x','z'].includes(axis))throw Error(tr('Indica entre 1 y 50 copias y una separación positiva.','Enter 1–50 copies and a positive spacing.'));
  source=validateFurniture(root,furnitureRoot(source,root),doors);source.updateWorldMatrix(true,true);
  const original=source.matrixWorld.clone(),copies=[];
  for(let i=1;i<=count;i++){
    const copy=duplicateFurniture(root,source,doors),d=new THREE.Vector3();d[axis]=spacing*i;
    copy.matrix.copy(source.parent.matrixWorld).invert().multiply(new THREE.Matrix4().makeTranslation(d.x,0,d.z)).multiply(original);
    copy.matrixAutoUpdate=false;copy.updateWorldMatrix(true,true);copies.push(copy);
  }
  return copies;
}
export function installPlacement(api){
  const panel=document.createElement('details');panel.id='furniturePlacement';panel.setAttribute('data-no-i18n','');
  const text=(es,en)=>`<span data-es="${es}" data-en="${en}">${tr(es,en)}</span>`;
  panel.innerHTML=`<summary>${text('Colocar muebles','Place furniture')}</summary>
<button id="placeFloor">${text('Apoyar en el suelo','Place on floor')}</button>
<p>${text('Busca una superficie debajo del mueble. Si no la hay, usa la cuadrícula Y = 0.','Finds a surface below the furniture. Falls back to the Y = 0 grid.')}</p>
<label>${text('Cuadrícula (m)','Grid (m)')}<select id="placeGrid"><option>0.1</option><option selected>0.25</option><option>0.5</option><option>1</option></select></label>
<label><input id="placeSnap" type="checkbox">${text('Ajustar al arrastrar','Snap while dragging')}</label>
<button id="placeAlign">${text('Alinear centros en X / Z','Align centers on X / Z')}</button>
<label>${text('Paso de giro','Rotation step')}<select id="placeAngle"><option>15</option><option selected>45</option><option>90</option></select></label>
<div class="coordinates"><button id="placeLeft">↶</button><button id="placeRight">↷</button></div>
<details><summary>${text('Duplicar en fila como proxies','Duplicate row as proxies')}</summary>
<label>${text('Número de copias nuevas','Number of new copies')}<input id="placeCount" type="number" min="1" max="50" value="3"></label>
<label>${text('Separación entre centros (m)','Center-to-center spacing (m)')}<input id="placeSpacing" type="number" min="0.01" step="0.1" value="1"></label>
<label>${text('Dirección en el mundo','World direction')}<select id="placeAxis"><option>X</option><option>Z</option></select></label>
<button id="placeRow">${text('Crear fila','Create row')}</button></details>`;
  document.getElementById('editPanel').after(panel);
  const $=id=>panel.querySelector('#'+id);
  const language=()=>{panel.querySelectorAll('[data-es]').forEach(e=>e.textContent=tr(e.dataset.es,e.dataset.en));$('placeLeft').title=tr('Girar a la izquierda','Rotate left');$('placeRight').title=tr('Girar a la derecha','Rotate right');};
  language();onLanguage(language);
  function run(kind){
    try{
      api.close();const objects=placementTargets(api.root(),api.selection(),api.doors());
      if(kind==='row'){
        if(objects.length!==1)throw Error(tr('Selecciona un solo mueble para la fila.','Select one furniture item for the row.'));
        const count=$('placeCount').valueAsNumber,spacing=$('placeSpacing').valueAsNumber;
        if(!Number.isInteger(count)||count<1||count>50||!Number.isFinite(spacing)||spacing<=0)throw Error(tr('Revisa la cantidad y la separación.','Check the count and spacing.'));
        api.record(tr('Crear fila de muebles','Create furniture row'));
        const copies=duplicateRow(api.root(),objects[0],api.doors(),count,spacing,$('placeAxis').value.toLowerCase());api.refresh(copies);
      }else{
        const plans=kind==='floor'?floorPlacement(api.root(),objects):kind==='grid'?gridPlacement(objects,Number($('placeGrid').value)):rotatePlacement(objects,Number($('placeAngle').value)*(kind==='left'?1:-1));
        api.record(tr('Colocar muebles','Place furniture'));applyPlacement(plans,api.doors());api.refresh(objects);
      }
      api.status(tr('Aplicado. Ctrl + Z deshace.','Applied. Ctrl + Z undoes.'));
    }catch(e){api.status(e.message);}
  }
  for(const [id,kind] of [['placeFloor','floor'],['placeAlign','grid'],['placeLeft','left'],['placeRight','right'],['placeRow','row']])$(id).onclick=()=>run(kind);
  const snap=()=>api.snap($('placeSnap').checked?Number($('placeGrid').value):null,$('placeSnap').checked?Number($('placeAngle').value):null);
  for(const id of ['placeSnap','placeGrid','placeAngle'])$(id).onchange=snap;
}
