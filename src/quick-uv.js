import * as THREE from 'three';
import {transformUV} from './uv-editor.js';
import {getLanguage,onLanguage} from './i18n.js';

// Shared world origin keeps neighbouring walls aligned, regardless of mesh transforms.
export function projectMetricUV(mesh,width,height){
  if(![width,height].every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid texture size');
  mesh.updateWorldMatrix(true,false);
  const source=mesh.geometry,g=source.index?source.toNonIndexed():source.clone();
  delete g.parameters;g.userData=structuredClone(source.userData);
  if(source.index&&g.userData.weldGroups){const corners=new Map();for(let i=0;i<source.index.count;i++){const v=source.index.getX(i);if(!corners.has(v))corners.set(v,[]);corners.get(v).push(i);}g.userData.weldGroups=g.userData.weldGroups.map(group=>group.flatMap(v=>corners.get(v)||[]));}
  const p=g.attributes.position,uv=new Float32Array(p.count*2);
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3();
  for(let i=0;i+2<p.count;i+=3){
    a.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,i+1).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(p,i+2).applyMatrix4(mesh.matrixWorld);
    normal.crossVectors(b.clone().sub(a),c.clone().sub(a));
    const x=Math.abs(normal.x),y=Math.abs(normal.y),z=Math.abs(normal.z);
    for(const [j,v] of [a,b,c].entries()){
      const u=x>y&&x>z?v.z:v.x,vertical=y>=x&&y>=z?-v.z:v.y;
      uv[(i+j)*2]=u/width;uv[(i+j)*2+1]=vertical/height;
    }
  }
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));return g;
}
export function installQuickUV(panel,api,meshes){
  const group=document.createElement('details');group.className='compact-group';group.open=true;group.setAttribute('data-no-i18n','');
  group.innerHTML='<summary></summary><p class="hint"></p><div class="coordinates"><label><span></span><input id="quickUVWidth" type="number" value="1" min="0.01" step="0.1"></label><label><span></span><input id="quickUVHeight" type="number" value="1" min="0.01" step="0.1"></label></div><button id="quickUVAuto" class="primary"></button><div class="uv-toolbar"><button id="quickUVLarger"></button><button id="quickUVSmaller"></button><button id="quickUVRotate"></button></div>';
  panel.querySelector('#openUV').before(group);
  const find=id=>group.querySelector('#'+id),word=(es,en)=>getLanguage()==='en'?en:es;
  function labels(){group.querySelector('summary').textContent=word('Ajuste rápido de textura','Quick texture adjustment');group.querySelector('p').textContent=word('Tamaño de una repetición en metros. Automático reemplaza las UV de las piezas seleccionadas; recomendado para paredes y suelos. Ctrl + Z deshace.','Size of one repeat in metres. Automatic replaces UVs on selected parts; recommended for walls and floors. Ctrl + Z undoes.');const spans=group.querySelectorAll('label span');spans[0].textContent=word('Ancho (m)','Width (m)');spans[1].textContent=word('Alto (m)','Height (m)');for(const [id,es,en] of [['Auto','Ajustar automáticamente','Fit automatically'],['Larger','Más grande','Larger'],['Smaller','Más pequeña','Smaller'],['Rotate','Girar 90°','Rotate 90°']])find('quickUV'+id).textContent=word(es,en);}
  function apply(mode){try{
    const targets=meshes(api.selection());if(!targets.length)throw Error(word('Selecciona una pared, suelo u otra pieza.','Select a wall, floor or another part.'));
    const width=find('quickUVWidth').valueAsNumber,height=find('quickUVHeight').valueAsNumber;
    if(mode==='Auto'&&![width,height].every(v=>Number.isFinite(v)&&v>0))throw Error(word('Introduce medidas mayores que cero.','Enter sizes greater than zero.'));
    if(mode!=='Auto'&&targets.some(m=>!m.geometry.attributes.uv))throw Error(word('Usa primero Ajustar automáticamente para crear las UV.','Use Fit automatically first to create UVs.'));
    api.close();
    const changes=targets.map(mesh=>({mesh,geometry:mode==='Auto'?projectMetricUV(mesh,width,height):transformUV(mesh.geometry,mode==='Rotate'?{angle:90}:{scaleX:mode==='Larger'?1/1.25:1.25,scaleY:mode==='Larger'?1/1.25:1.25})}));
    api.record(word('Ajustar textura','Adjust texture'));
    for(const {mesh,geometry} of changes){mesh.geometry=geometry;const multiple=Array.isArray(mesh.material),materials=multiple?mesh.material:[mesh.material];const updated=materials.map(m=>{const copy=m.clone();if(m.map){copy.map=m.map.clone();copy.map.wrapS=copy.map.wrapT=THREE.RepeatWrapping;copy.map.needsUpdate=true;}return copy;});mesh.material=multiple?updated:updated[0]; }
    api.status(word('Textura ajustada. Ctrl + Z deshace.','Texture adjusted. Ctrl + Z undoes.'));
  }catch(error){api.status(error.message);}}
  for(const mode of ['Auto','Larger','Smaller','Rotate'])find('quickUV'+mode).onclick=()=>apply(mode);
  labels();onLanguage(labels);
}

