import * as THREE from 'three';
import {setShapes,defaultShape} from './layers.js';
import {getLanguage,onLanguage} from './i18n.js';
const tr=(es,en)=>getLanguage()==='en'?en:es;

export function validateRoom(s){
  if(![s.width,s.depth,s.height,s.thickness,s.openingWidth,s.openingHeight,s.openingOffset,s.x,s.y,s.z,s.heading].every(Number.isFinite))throw Error(tr('Introduce medidas válidas.','Enter valid measurements.'));
  if(s.width<1||s.depth<1||s.height<1.8||Math.max(s.width,s.depth,s.height)>100||s.thickness<.02||s.thickness>.5)throw Error(tr('Habitación: ancho y fondo de 1 a 100 m, altura de 1,8 a 100 m y grosor de 0,02 a 0,5 m.','Room: width/depth 1–100 m, height 1.8–100 m, thickness 0.02–0.5 m.'));
  if(s.openingWidth<.7||s.openingHeight<1.8||s.openingHeight>s.height-.05||Math.abs(s.openingOffset)+s.openingWidth/2>s.width/2-.05)throw Error(tr('La entrada debe medir al menos 0,7 × 1,8 m y caber dentro de la pared.','The entrance must be at least 0.7 × 1.8 m and fit within the wall.'));
}

// Dimensions describe usable interior space; wall thickness grows outward.
export function createRoom(s){
  validateRoom(s);
  const room=new THREE.Group();room.name=tr('Interior','Interior');room.userData.abtInterior={version:1,...s};
  room.position.set(s.x,s.y,s.z);room.rotation.y=THREE.MathUtils.degToRad(s.heading);
  const w=s.width,d=s.depth,h=s.height,t=s.thickness;
  const add=(name,size,position,floor=false)=>{
    const material=new THREE.MeshStandardMaterial({color:floor?0x777d83:0xb1b5b8,roughness:.9,metalness:0});
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.name=name;mesh.userData.abtInteriorSurface=floor?'floor':name===tr('Techo interior','Interior ceiling')?'ceiling':'wall';mesh.position.fromArray(position);
    // Metre-sized UVs on every side rather than stretching one tile across a wall.
    const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,uv=mesh.geometry.attributes.uv;
    for(let i=0;i<p.count;i++){const normal=new THREE.Vector3().fromBufferAttribute(n,i);uv.setXY(i,Math.abs(normal.x)>.5?p.getZ(i):p.getX(i),Math.abs(normal.y)>.5?p.getZ(i):p.getY(i));}
    for(const layer of ['geometry','fire','view'])setShapes(mesh,layer,[defaultShape(mesh)]);
    setShapes(mesh,'roadway',floor?[{name:tr('Suelo interior','Interior floor'),center:[0,t/2,0],size:[w+2*t,0,d+2*t],rotation:[0,0,0]}]:[]);
    room.add(mesh);return mesh;
  };
  add(tr('Suelo interior','Interior floor'),[w+2*t,t,d+2*t],[0,-t/2,0],true);
  add(tr('Pared izquierda','Left wall'),[t,h,d+2*t],[-(w+t)/2,h/2,0]);
  add(tr('Pared derecha','Right wall'),[t,h,d+2*t],[(w+t)/2,h/2,0]);
  add(tr('Pared del fondo','Back wall'),[w,h,t],[0,h/2,(d+t)/2]);
  const left=s.openingOffset-s.openingWidth/2,right=s.openingOffset+s.openingWidth/2,z=-(d+t)/2;
  add(tr('Entrada · izquierda','Entrance · left'),[left+w/2,h,t],[(-w/2+left)/2,h/2,z]);
  add(tr('Entrada · derecha','Entrance · right'),[w/2-right,h,t],[(w/2+right)/2,h/2,z]);
  add(tr('Entrada · dintel','Entrance · lintel'),[s.openingWidth,h-s.openingHeight,t],[s.openingOffset,(h+s.openingHeight)/2,z]);
  if(s.ceiling)add(tr('Techo interior','Interior ceiling'),[w+2*t,t,d+2*t],[0,h+t/2,0]);
  room.updateMatrixWorld(true);return room;
}

export function installInteriors(api){
  const panel=document.createElement('section');panel.id='interiorPanel';panel.dataset.noI18n='';
  document.querySelector('.properties').append(panel);
  const text=(es,en)=>`<span data-es="${es}" data-en="${en}">${tr(es,en)}</span>`;
  const fields=[['width','Ancho útil (m)','Usable width (m)',4],['depth','Fondo útil (m)','Usable depth (m)',5],['height','Altura útil (m)','Usable height (m)',2.8],['thickness','Grosor de paredes y suelo (m)','Wall and floor thickness (m)',.15],['openingWidth','Ancho de entrada (m)','Entrance width (m)',1],['openingHeight','Altura de entrada (m)','Entrance height (m)',2.1],['openingOffset','Desplazamiento lateral de entrada (m)','Entrance sideways offset (m)',0],['x','Posición X (m)','Position X (m)',0],['y','Altura del suelo Y (m)','Floor height Y (m)',0],['z','Posición Z (m)','Position Z (m)',0],['heading','Giro (°)','Rotation (°)',0]];
  panel.innerHTML=`<h3>${text('Habitación de una planta','Single-storey room')}</h3><p>${text('Crea paredes, suelo y una entrada transitable. El suelo empieza en la altura Y indicada; el grosor crece hacia fuera.','Creates walls, a floor and a walkable entrance. Floor level is the specified Y height; thickness grows outward.')}</p><button id="interiorFit">${text('Centrar en la selección','Center on selection')}</button>`;
  for(const [i,label] of [[0,['Medidas','Dimensions']],[4,['Entrada · pared frontal','Entrance · front wall']],[7,['Posición y giro','Position and rotation']]]){
    const details=document.createElement('details');details.open=true;details.innerHTML=`<summary>${text(...label)}</summary>`;
    for(const [key,es,en,value] of fields.slice(i,i===0?4:i===4?7:11))details.innerHTML+=`<label>${text(es,en)}<input id="interior-${key}" type="number" step="${key==='heading'?5:.05}" value="${value}"></label>`;
    panel.append(details);
  }
  panel.insertAdjacentHTML('beforeend',`<label><input id="interior-ceiling" type="checkbox" checked>${text('Añadir techo','Add ceiling')}</label><p>${text('La entrada está en el lado −Z antes de girar. Esta primera fase añade una habitación: no recorta el exterior ni elimina las colisiones del edificio existente. Si se superponen, seguirán bloqueando el paso.','The entrance is on the −Z side before rotation. This first stage adds a room: it does not cut the exterior or remove existing building collisions. Overlapping collisions will still block passage.')}</p><button id="interiorPreview">${text('Ver vista previa','Show preview')}</button><button id="interiorHide">${text('Ocultar vista previa','Hide preview')}</button><button id="interiorCreate" class="primary">${text('Crear habitación','Create room')}</button>`);
  onLanguage(()=>panel.querySelectorAll('[data-es]').forEach(e=>e.textContent=tr(e.dataset.es,e.dataset.en)));
  const $=id=>document.getElementById(id);
  let preview=null;
  const read=()=>({...Object.fromEntries(fields.map(([key])=>[key,$('interior-'+key).valueAsNumber])),ceiling:$('interior-ceiling').checked});
  function clear(){if(!preview)return;api.scene.remove(preview);preview.traverse(m=>{m.geometry?.dispose();m.material?.dispose();});preview=null;}
  function show(){try{const next=createRoom(read());clear();next.traverse(m=>{if(m.isMesh){m.material.transparent=true;m.material.opacity=.23;m.material.depthWrite=false;m.material.color.setHex(0xff7a32);const line=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),new THREE.LineBasicMaterial({color:0xffa35e}));m.add(line);}});preview=next;api.scene.add(preview);}catch(e){clear();api.status(e.message);}}
  $('interiorPreview').onclick=show;$('interiorHide').onclick=clear;
  panel.addEventListener('input',()=>{if(preview)show();});
  $('interiorFit').onclick=()=>{const items=api.selection();if(!items.length){api.status(tr('Selecciona una pieza para situar la habitación.','Select a part to position the room.'));return;}
    const box=new THREE.Box3();for(const object of items){object.updateWorldMatrix(true,true);box.union(new THREE.Box3().setFromObject(object));}
    if(box.isEmpty())return;const c=box.getCenter(new THREE.Vector3());for(const [k,v]of [['x',c.x],['y',box.min.y],['z',c.z]])$('interior-'+k).value=v.toFixed(3);show();};
  $('interiorCreate').onclick=()=>{try{const room=createRoom(read());api.commit(room);clear();api.status(tr('Habitación creada con colisiones y suelo transitable. Ctrl + Z deshace. Revisa cualquier colisión del edificio exterior.','Room created with collision and walkable floor. Ctrl + Z undoes. Review any exterior building collision.'));}catch(e){api.status(e.message);}};
  return {clear};
}
