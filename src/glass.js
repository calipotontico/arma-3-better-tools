import {getLanguage,onLanguage} from './i18n.js';
import { readLights } from './lighting-data.js';
import {sceneName} from './automatic-names.js';
import * as THREE from 'three';
import { doorOwner } from './selection.js';

export const glassDefaults={color:'#6f7676',opacity:.025,resistance:.001,explosion:1,minimalHit:0,bulletproof:false};
export function glassFireShape(mesh,shape,scale=1){
  const result=structuredClone(shape);if(!mesh.userData.armaGlass?.bulletproof)return result;
  const rotation=new THREE.Euler(...shape.rotation.map(THREE.MathUtils.degToRad));
  const linear=new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld);
  const factors=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)].map(v=>v.applyEuler(rotation).applyMatrix3(linear).length()*scale);
  if(factors.some(v=>!Number.isFinite(v)||v<1e-9))throw Error('Escala del cristal antibalas inválida.');
  const lengths=shape.size.map((v,i)=>v*factors[i]),axis=lengths.indexOf(Math.min(...lengths));
  result.size[axis]=Math.max(result.size[axis],.03/factors[axis]);return result;
}
export function collectGlass(root,doors={}){
  const result=[];root.traverse(mesh=>{
    const d=mesh.userData.armaGlass;if(!d)return;
    if(d.bulletproof!==undefined&&typeof d.bulletproof!=='boolean')throw Error('Opción de cristal antibalas inválida.');
    if(!mesh.isMesh||doorOwner(mesh,root)||(doors[mesh.uuid]&&doors[mesh.uuid].confirmed!==false))throw Error('Los cristales deben ser piezas independientes y fijas, fuera de puertas.');
    if(readLights(root).some(l=>l.lampId===mesh.uuid))throw Error('Una pieza no puede ser lámpara y cristal a la vez.');
    for(let p=mesh;p;p=p.parent)if(!p.visible)throw Error('Hay un cristal oculto. Muéstralo o quita su configuración.');
    if(!/^#[a-f0-9]{6}$/i.test(d.color)||!Number.isFinite(d.opacity)||d.opacity<=0||d.opacity>=1||!Number.isFinite(d.resistance)||d.resistance<=0||d.resistance>10||!Number.isFinite(d.explosion)||d.explosion<0||d.explosion>100||!Number.isFinite(d.minimalHit)||d.minimalHit<0||d.minimalHit>1)throw Error('Ajustes de cristal inválidos.');
    if(!mesh.geometry.attributes.position?.count)throw Error('Cristal sin vértices.');
    result.push({...d,mesh,id:result.length+1});
  });if(result.length>64)throw Error('Esta versión permite hasta 64 cristales.');return result;
}
// A deterministic, original crack pattern, shared by preview and exported PNGs.
export function glassPixels(d,cracked,size=256){
  const bytes=new Uint8Array(size*size*4),c=new THREE.Color(d.color).getHex(THREE.SRGBColorSpace),rgb=[c>>16,(c>>8)&255,c&255];
  for(let i=0;i<bytes.length;i+=4){bytes.set(rgb,i);bytes[i+3]=Math.round(d.opacity*255);}
  const dot=(x,y)=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=size||y>=size)return;const i=(y*size+x)*4;bytes.set([225,240,245,210],i);};
  const line=(x,y,a,b)=>{const n=Math.ceil(Math.hypot(a-x,b-y));for(let k=0;k<=n;k++)dot(x+(a-x)*k/n,y+(b-y)*k/n);};
  if(cracked)for(let j=0;j<13;j++){let x=size*.46,y=size*.53;const angle=j*Math.PI*2/13;for(let k=1;k<=5;k++){const a=size*.46+Math.cos(angle+Math.sin(j*7+k)*.13)*size*k*.13,b=size*.53+Math.sin(angle+Math.cos(j*3+k)*.13)*size*k*.13;line(x,y,a,b);if(k===2||k===4)line(a,b,a+Math.cos(angle+.7)*size*.14,b+Math.sin(angle+.7)*size*.14);x=a;y=b;}}
  return bytes;
}
export function glassTexture(d,cracked){const texture=new THREE.DataTexture(glassPixels(d,cracked),256,256);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;return texture;}
export function encodeGlass(d,cracked){const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.putImageData(new ImageData(new Uint8ClampedArray(glassPixels(d,cracked)),256,256),0,0);return canvas.toDataURL('image/png').split(',')[1];}
// Sample real triangles, not their bounding box: cover large panes without points in holes.
export function glassHitPoints(mesh,scale=1,radius=.25){
  const g=mesh.geometry,p=g.attributes.position,idx=g.index,points=new Map(),count=idx?.count??p.count;
  for(let i=g.drawRange.start;i+2<Math.min(count,g.drawRange.start+g.drawRange.count);i+=3){
    const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld).multiplyScalar(scale));
    const n=Math.max(1,Math.ceil(Math.max(v[0].distanceTo(v[1]),v[1].distanceTo(v[2]),v[2].distanceTo(v[0]))/(radius*1.1)));
    if(n>200)throw Error('Cristal demasiado grande: revisa la escala o divídelo.');
    for(let a=0;a<=n;a++)for(let b=0;b<=n-a;b++){const q=v[0].clone().multiplyScalar(1-(a+b)/n).addScaledVector(v[1],a/n).addScaledVector(v[2],b/n);points.set(q.toArray().map(x=>x.toFixed(4)).join(','),[q.x,q.y,-q.z]);if(points.size>12000)throw Error('Demasiados puntos de daño en un cristal. Divide la pieza.');}
  }return [...points.values()];
}
export function moveGlassTop(lod){
  // Object Builder's Move Top puts selected faces at the END of the face list.
  // Drawing NoZWrite glass before the building lets later opaque faces erase it.
  const order=lod.faces.map((f,i)=>i).sort((a,b)=>(lod.faces[a].glassOrder||0)-(lod.faces[b].glassOrder||0)),remap=new Map(order.map((old,i)=>[old,i]));
  lod.faces=order.map(i=>lod.faces[i]);for(const s of Object.values(lod.selections))s.faces=new Set([...s.faces].map(i=>remap.get(i)));
}
export function installGlass(api){
  const panel=document.createElement('section');panel.className='lighting-panel';panel.innerHTML=`<div class="section-title">CRISTALES</div><p class="hint">Selecciona solo el cristal, sin el marco. Una pieza por panel; fijos en esta versión.</p><label for="glassList">Cristales configurados</label><select id="glassList"><option value="">Selecciona un cristal</option></select><p class="hint" id="glassSelected"></p><button id="assignGlass">Configurar selección como cristal</button><label for="glassColor">Tinte (solo vista previa)</label><input id="glassColor" type="color"><label for="glassOpacity">Opacidad del visor (0,01–0,99)</label><input id="glassOpacity" type="number" min=".01" max=".99" step=".01"><label for="glassResistance">Resistencia a romperse (armor)</label><input id="glassResistance" type="number" min=".00001" max="10" step=".001"><label for="glassExplosion">Multiplicador de daño por explosiones</label><input id="glassExplosion" type="number" min="0" max="100" step=".1"><label for="glassMinimal">Daño mínimo aceptado</label><input id="glassMinimal" type="number" min="0" max="1" step=".001"><button id="saveGlass">Guardar ajustes del cristal</button><button id="removeGlass">Quitar configuración de cristal</button><label for="glassPreview">Vista previa de daño</label><select id="glassPreview"><option value="0">Intacto</option><option value=".5">Agrietado (50 %)</option><option value="1">Roto (100 %)</option></select><p class="hint">La vista previa no se guarda como daño inicial. Más resistencia retrasa la rotura, pero no hace el vidrio antibalas. El daño depende de la munición y la distancia. Al exportar: Move top automático, puntos de daño y colisión que desaparece al romperse. En Arma se usan texturas y materiales originales del juego, conservando los UV. El visor sigue siendo una aproximación; su tinte y opacidad no se exportan. Ctrl + Z deshace los ajustes.</p>`;
  document.getElementById('layerPanel').append(panel);const $=id=>document.getElementById(id),fields=[['glassColor','color'],['glassOpacity','opacity'],['glassResistance','resistance'],['glassExplosion','explosion'],['glassMinimal','minimalHit']];
  const ballistic=document.createElement('label');ballistic.innerHTML='<input id="glassBulletproof" type="checkbox"> Cristal antibalas';$('glassColor').previousElementSibling.before(ballistic);
  const ballisticHint=document.createElement('p');ballisticHint.className='hint';ballisticHint.textContent='Antibalas aplica un material físico más resistente a la penetración y un grosor mínimo de disparos de 3 cm. Sigue agrietándose y rompiéndose. Al activarlo se propone resistencia 0,01; guarda para aplicar. No garantiza detener munición pesada o perforante.';ballistic.after(ballisticHint);
  panel.querySelector('p:last-child').textContent=panel.querySelector('p:last-child').textContent.replace('Más resistencia retrasa la rotura, pero no hace el vidrio antibalas.','La resistencia regula la rotura; Antibalas regula la penetración.');
  const exportHint=panel.querySelector('p:last-child');exportHint.setAttribute('data-no-i18n','');
  const hintText=()=>exportHint.textContent=getLanguage()==='en'?'Export uses clean transparent glass with subtle reflections. Cracks appear only after damage. Both sides remain visible; collision disappears when broken. Preview tint and opacity are approximate and are not exported. Ctrl + Z undoes changes.':'La exportación usa cristal limpio y transparente con reflejos suaves. Las grietas aparecen solo al recibir daño. Se ve por ambos lados y la colisión desaparece al romperse. El tinte y la opacidad del visor son orientativos y no se exportan. Ctrl + Z deshace.';hintText();onLanguage(hintText);
  $('glassBulletproof').onchange=()=>{if($('glassBulletproof').checked)$('glassResistance').value=Math.max(.01,$('glassResistance').valueAsNumber||0);};
  let lastRoot,lastMesh,lastData,signature='',cache=new Map();
  const selected=()=>api.selection().length===1?api.selection()[0]:null;
  function sync(){const root=api.root(),mesh=selected(),d=mesh?.userData.armaGlass;let list=[];root?.traverse(m=>{if(m.userData.armaGlass)list.push(m);});const sig=list.map(m=>m.uuid+m.name).join();if(sig!==signature||root!==lastRoot){$('glassList').replaceChildren(new Option('Selecciona un cristal',''),...list.map(m=>new Option(m.name||'Cristal',m.uuid)));signature=sig;$('glassList').value=d?mesh.uuid:'';}
    $('glassSelected').textContent=mesh?'Pieza: '+(mesh.name||'sin nombre'):'Selecciona una pieza';if(root===lastRoot&&mesh===lastMesh&&d===lastData)return;lastRoot=root;lastMesh=mesh;lastData=d;$('glassPreview').value='0';$('glassSelected').textContent=mesh?'Pieza: '+(mesh.name||'sin nombre'):'Selecciona una pieza';$('glassList').value=d?mesh.uuid:'';fields.forEach(([id,key])=>$(id).value=(d||glassDefaults)[key]);$('glassBulletproof').checked=!!d?.bulletproof;
  }
  function change(label,edit){try{api.close();const mesh=selected();if(!api.root()||!mesh?.isMesh)throw Error('Selecciona una única pieza de cristal.');const next=edit(mesh);const previous=mesh.userData.armaGlass;try{if(next)mesh.userData.armaGlass=next;else delete mesh.userData.armaGlass;collectGlass(api.root(),api.doors());}finally{if(previous)mesh.userData.armaGlass=previous;else delete mesh.userData.armaGlass;}api.record(label);if(next&&!previous)mesh.name=sceneName(api.root(),'glass');if(next)mesh.userData.armaGlass=next;else delete mesh.userData.armaGlass;lastData=null;sync();api.status(label+'. Ctrl + Z deshace.');}catch(e){api.status(e.message);}}
  $('assignGlass').onclick=()=>change('Configurar cristal',m=>structuredClone(m.userData.armaGlass||glassDefaults));
  $('saveGlass').onclick=()=>change('Editar cristal',()=>({...Object.fromEntries(fields.map(([id,key])=>[key,key==='color'?$(id).value:$(id).valueAsNumber])),bulletproof:$('glassBulletproof').checked}));
  $('removeGlass').onclick=()=>change('Quitar cristal',()=>null);
  $('glassList').onchange=()=>{const m=api.root()?.getObjectByProperty('uuid',$('glassList').value);if(m)api.select(m);};
  return {render(draw){sync();const root=api.root(),saved=[],used=new Set();try{root?.traverse(m=>{const d=m.userData.armaGlass;if(!m.isMesh||!d)return;used.add(m.uuid);let entry=cache.get(m.uuid);if(!entry||entry.data!==d){if(entry)entry.materials.forEach(x=>{x.map.dispose();x.dispose();});entry={data:d,materials:[false,true].map(cracked=>new THREE.MeshStandardMaterial({map:glassTexture(d,cracked),transparent:true,depthWrite:false,roughness:.15,metalness:.05,side:THREE.DoubleSide}))};cache.set(m.uuid,entry);}saved.push([m,m.material,m.visible,m.castShadow,m.renderOrder]);const damage=m===selected()?Number($('glassPreview').value):0;m.material=entry.materials[damage>=.5?1:0];m.visible=m.visible&&damage<1;m.castShadow=false;m.renderOrder=10;});draw();}finally{saved.forEach(([m,material,visible,castShadow,renderOrder])=>Object.assign(m,{material,visible,castShadow,renderOrder}));for(const [id,e] of cache)if(!used.has(id)){e.materials.forEach(m=>{m.map.dispose();m.dispose();});cache.delete(id);}}}};
}
