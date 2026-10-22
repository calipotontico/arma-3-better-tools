import {installQuickUV} from './quick-uv.js';
import {getLanguage,onLanguage} from './i18n.js';
import * as THREE from 'three';
export function materialMeshes(objects){const set=new Set();for(const object of objects)object.traverse(m=>{if(m.isMesh)set.add(m);});return [...set];}
export function applyLibraryMaterial(objects,entry,texture){
  for(const mesh of materialMeshes(objects)){
    const create=()=>new THREE.MeshStandardMaterial({map:texture,color:0xffffff,roughness:.65,userData:{armaLibrary:structuredClone(entry)}});
    mesh.material=Array.isArray(mesh.material)?mesh.material.map(create):create();
  }
}
export function libraryResources(entry,addonId){
  if(!/^[a-f0-9-]{36}$/.test(entry.id))throw Error('Material de biblioteca inválido.');
  const prefix=`data/library/${entry.id}`,base=`${addonId}\\${prefix.replaceAll('/','\\')}`;
  const files=entry.files.map(f=>{
    if(!/^[a-f0-9]{20}(?:_[a-z0-9]+)?\.(paa|rvmat|bisurf)$/.test(f.name))throw Error('Recurso de biblioteca inválido.');
    let data=f.data;
    if(/\.(rvmat|bisurf)$/.test(f.name)){
      const text=new TextDecoder().decode(Uint8Array.from(atob(data),c=>c.charCodeAt(0))).replaceAll('__ABT_MATERIAL__',base);
      data=btoa(Array.from(new TextEncoder().encode(text),b=>String.fromCharCode(b)).join(''));
    }
    return {name:prefix+'/'+f.name,data};
  });
  if(!entry.files.some(f=>f.name===entry.texture)||!entry.files.some(f=>f.name===entry.rvmat))throw Error('Faltan archivos del material.');
  return {texture:base+'\\'+entry.texture,material:base+'\\'+entry.rvmat,files};
}
export function installMaterialLibrary(api){
  const panel=document.createElement('section');panel.id='materialLibrary';
  panel.innerHTML=`<h3>Mi biblioteca</h3><p class="hint">Disponible en todos tus proyectos. Cada material reúne textura y RVMAT. La vista previa es aproximada; Arma usa el RVMAT original.</p><label>Nombre del material<input id="libraryName" maxlength="80" placeholder="Por ejemplo, Cromado"></label><button id="libraryImport">Importar textura + RVMAT</button><label>Buscar<input id="librarySearch" type="search" placeholder="Nombre del material"></label><select id="libraryList" size="6" aria-label="Materiales de mi biblioteca"></select><img id="libraryPreview" alt="Vista previa de la textura" hidden><p id="libraryInfo" class="hint" role="status"></p><button id="libraryRename">Guardar nombre</button><button id="libraryApply" class="primary">Aplicar a la selección</button><button id="openUV">Abrir editor UV</button><p class="hint">Selecciona objetos o una pieza dentro de una puerta. Aplicar reemplaza sus materiales. Ctrl + Z deshace. Luces y cristales configurados conservan su material especial al exportar.</p>`;
  document.querySelector('.properties').append(panel);const $=id=>document.getElementById(id),service=window.desktop?.materials;
  const category=document.createElement('select');category.id='libraryCategory';category.setAttribute('data-no-i18n','');$('librarySearch').before(category);
  const labels=()=>{const en=getLanguage()==='en';const old=category.value;category.replaceChildren(new Option(en?'All materials':'Todos los materiales','all'),new Option(en?'Included · CC0':'Incluidos · CC0','builtin'),new Option(en?'My materials':'Mis materiales','personal'));category.value=old||'all';category.setAttribute('aria-label',en?'Material collection':'Colección de materiales');paint();};
  let entries=[],current=null,loading=false,request=0;
  function paint(){const value=$('libraryList').value,q=$('librarySearch').value.toLowerCase();$('libraryList').replaceChildren(...entries.filter(e=>(category.value!=='builtin'||e.builtin)&&(category.value!=='personal'||!e.builtin)).filter(e=>(e.names?.[getLanguage()]||e.name).toLowerCase().includes(q)).map(e=>new Option(e.names?.[getLanguage()]||e.name,e.id)));$('libraryList').value=value;}
  async function refresh(){entries=await service.list();paint();}
  async function choose(id){const token=++request;current=null;$('libraryApply').disabled=true;if(!id)return;try{const entry=await service.get(id);if(token!==request)return;current=entry;$('libraryName').value=entry.name;$('libraryPreview').src=entry.preview;$('libraryPreview').hidden=false;$('libraryInfo').setAttribute('data-no-i18n','');$('libraryInfo').textContent=entry.builtin?`CC0 · ambientCG · ${entry.source}`:entry.files.length+(getLanguage()==='en'?' resources in your library.':' recursos guardados en tu biblioteca.');$('libraryApply').disabled=false;}catch(e){$('libraryInfo').textContent=e.message;}}
  async function operation(fn){if(loading)return;loading=true;try{await fn();}catch(e){$('libraryInfo').textContent=e.message;api.status(e.message);}finally{loading=false;}}
  $('librarySearch').oninput=paint;$('libraryList').onchange=()=>choose($('libraryList').value);
  $('libraryImport').onclick=()=>operation(async()=>{$('libraryInfo').textContent='Importando y copiando recursos…';const entry=await service.import($('libraryName').value);if(!entry){$('libraryInfo').textContent='Importación cancelada.';return;}await refresh();$('librarySearch').value='';paint();$('libraryList').value=entry.id;await choose(entry.id);});
  $('libraryRename').onclick=()=>operation(async()=>{if(!current)throw Error('Selecciona un material.');await service.rename(current.id,$('libraryName').value);const id=current.id;await refresh();await choose(id);});
  $('libraryApply').onclick=()=>operation(async()=>{
    if(!current)throw Error('Selecciona un material.');const targets=materialMeshes(api.selection());if(!targets.length)throw Error('Selecciona al menos una pieza.');
    const root=api.root(),entry=structuredClone(current),texture=await new THREE.TextureLoader().loadAsync(entry.preview);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    if(root!==api.root()||targets.some(m=>root.getObjectByProperty('uuid',m.uuid)!==m)){texture.dispose();throw Error('El proyecto cambió. Selecciona las piezas de nuevo.');}
    api.close();api.record('Aplicar material de biblioteca');applyLibraryMaterial(targets,entry,texture);api.status(entry.name+' aplicado a '+targets.length+' piezas. Ctrl + Z deshace.');
  });
  $('openUV').onclick=()=>api.openUV();
  installQuickUV(panel,api,materialMeshes);
  category.onchange=paint;onLanguage(labels);labels();
  if(service)refresh().catch(e=>$('libraryInfo').textContent=e.message);else{$('libraryInfo').textContent='La biblioteca compartida está disponible en la app de escritorio.';for(const id of ['libraryImport','libraryRename','libraryApply'])$(id).disabled=true;}
}

