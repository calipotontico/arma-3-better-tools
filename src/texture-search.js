import * as T from 'three';
import {getLanguage,onLanguage} from './i18n.js';
export function applyCatalogTexture(targets,payload,texture){
  for(const mesh of targets){const make=()=>new T.MeshStandardMaterial({name:payload.id,map:texture,color:0xffffff,roughness:.8,userData:{polyhavenTexture:{id:payload.id,resolution:payload.resolution,source:payload.source,license:'CC0'}}});mesh.material=Array.isArray(mesh.material)?mesh.material.map(make):make();}
}
export function installTextureSearch(parent,api,materialMeshes){
 const panel=document.createElement('details');panel.id='textureSearchPanel';panel.dataset.noI18n='';parent.prepend(panel);
 const service=window.desktop?.textureCatalog,tr=(es,en)=>getLanguage()==='en'?en:es,make=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
 let entries=[],page=0,token=0,busy=false,loading=false,selected=null;const thumbs=new Map();
 function render(){
  token++;panel.replaceChildren(make('summary',tr('Buscar texturas gratis · Poly Haven','Search free textures · Poly Haven')));
  panel.append(make('p',tr('Texturas CC0, sin cuenta ni claves. Se descarga el color base y queda guardado en el proyecto.','CC0 textures, no account or keys. The base color is downloaded and saved in your project.')));
  const form=make('form'),query=make('input'),search=make('button',tr('Buscar','Search'));query.type='search';query.placeholder=tr('Hormigón, ladrillo, madera…','Concrete, brick, wood…');query.setAttribute('aria-label',tr('Buscar texturas','Search textures'));form.append(query,search);panel.append(form);
  const status=make('p');status.setAttribute('role','status');const grid=make('div');grid.className='polyhaven-grid';const nav=make('div'),prev=make('button','‹'),next=make('button','›'),pages=make('span'),detail=make('div');prev.type=next.type='button';prev.title=tr('Anterior','Previous');next.title=tr('Siguiente','Next');nav.append(prev,pages,next);panel.append(status,grid,nav,detail);
  const aliases={cemento:'concrete',hormigon:'concrete',ladrillo:'brick',ladrillos:'brick',madera:'wood',metal:'metal',suelo:'floor',baldosas:'tiles',piedra:'stone',asfalto:'asphalt',pared:'wall',yeso:'plaster'};
  function filtered(){const q=query.value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');return entries.filter(v=>[v.name,v.id,v.category,...v.tags].join(' ').toLowerCase().includes(aliases[q]||q));}
  async function choose(item){
   if(busy)return;selected=item;detail.replaceChildren(make('h4',item.name));status.textContent=tr('Consultando tamaños…','Checking sizes…');
   try{const sizes=await service.details(item.id);if(selected!==item)return;const resolution=make('select');resolution.setAttribute('aria-label',tr('Resolución','Resolution'));for(const s of sizes)resolution.append(new Option(`${s.resolution} · ${(s.size/1048576).toFixed(1)} MB`,s.resolution));detail.append(resolution);
    if(!sizes.length){status.textContent=tr('No hay un formato compatible.','No compatible format.');return;}
    const apply=make('button',tr('Descargar y aplicar a la selección','Download and apply to selection'));apply.className='primary';detail.append(apply);status.textContent='';
    apply.onclick=async()=>{if(busy)return;const root=api.root(),targets=materialMeshes(api.selection());if(!root||!targets.length){status.textContent=tr('Selecciona primero las piezas del modelo.','Select model parts first.');return;}
     busy=true;apply.disabled=true;status.textContent=tr('Descargando textura…','Downloading texture…');let texture;
     try{const payload=await service.download(item.id,resolution.value);texture=await new T.TextureLoader().loadAsync(payload.image);texture.colorSpace=T.SRGBColorSpace;texture.flipY=false;texture.wrapS=texture.wrapT=T.RepeatWrapping;
      if(api.root()!==root||targets.some(m=>root.getObjectByProperty('uuid',m.uuid)!==m))throw Error(tr('El proyecto cambió durante la descarga.','Project changed during download.'));
      api.close();api.record(tr('Aplicar textura de Poly Haven','Apply Poly Haven texture'));applyCatalogTexture(targets,payload,texture);texture=null;status.textContent=tr('Aplicada. Ajusta el tamaño en UV rápido. Ctrl + Z deshace.','Applied. Adjust size in Quick UV. Ctrl + Z undoes.');api.status(status.textContent);
     }catch(e){texture?.dispose();status.textContent=e.message;}finally{busy=false;apply.disabled=false;}
    };
   }catch(e){if(selected===item)status.textContent=e.message;}
  }
  function paint(){const generation=++token,all=filtered();page=Math.max(0,Math.min(page,Math.ceil(all.length/8)-1));grid.replaceChildren();prev.disabled=page===0;next.disabled=(page+1)*8>=all.length;pages.textContent=` ${page+1} / ${Math.max(1,Math.ceil(all.length/8))} · ${all.length} `;const jobs=[];
   for(const item of all.slice(page*8,page*8+8)){const b=make('button'),image=make('img');b.type='button';b.className='polyhaven-card';image.alt=item.name;b.append(image,make('span',item.name));b.onclick=()=>choose(item);grid.append(b);jobs.push(async()=>{try{if(!thumbs.has(item.id))thumbs.set(item.id,await service.thumbnail(item.id));if(generation===token)image.src=thumbs.get(item.id);}catch{image.alt=tr('Sin vista previa','Preview unavailable');}});}
   for(let i=0;i<2;i++)void(async()=>{while(jobs.length&&generation===token)await jobs.shift()();})();
  }
  form.onsubmit=async e=>{e.preventDefault();if(loading||busy)return;if(!service){status.textContent=tr('Disponible en la app de escritorio.','Available in the desktop app.');return;}loading=true;search.disabled=true;status.textContent=tr('Cargando catálogo…','Loading catalog…');try{if(!entries.length)entries=await service.list();page=0;paint();status.textContent=filtered().length?'':tr('Sin resultados.','No results.');}catch(e){status.textContent=tr('No se pudo conectar. Pulsa Buscar para reintentar. ','Connection failed. Press Search to retry. ')+e.message;}finally{loading=false;search.disabled=false;}};
  prev.onclick=()=>{page--;paint();};next.onclick=()=>{page++;paint();};if(entries.length)paint();else{prev.disabled=next.disabled=true;status.textContent=tr('Pulsa Buscar para consultar el catálogo.','Press Search to browse the catalog.');}
 }
 render();onLanguage(()=>{if(!busy&&!loading)render();});
}
