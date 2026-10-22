import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {getLanguage,onLanguage} from './i18n.js';
export async function loadPolyHaven(payload){
  const manager=new THREE.LoadingManager();
  manager.setURLModifier(url=>{if(!/^(data:|blob:)/.test(url))throw Error('External model dependency blocked');return url;});
  const model=(await new GLTFLoader(manager).parseAsync(JSON.stringify(payload.gltf),'')).scene;
  // Keep images self-contained and serializable for project save/reload and export.
  const textures=new Set();model.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material))for(const v of Object.values(m))if(v?.isTexture)textures.add(v);});
  for(const texture of textures){
    const image=texture.image;if(!image)continue;
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);
    const stored=new Image();
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Texture load timed out')),20000);
      stored.onload=()=>{clearTimeout(timer);resolve();};
      stored.onerror=()=>{clearTimeout(timer);reject(Error('Could not load embedded texture'));};
      stored.src=canvas.toDataURL('image/png');
    });
    texture.image=stored;texture.needsUpdate=true;
  }
  model.name=payload.id;model.userData.polyhaven={id:payload.id,source:payload.source,license:'CC0',resolution:payload.resolution};
  return model;
}
export function installPolyHaven(api){
  const panel=document.createElement('section');panel.id='polyhavenPanel';panel.setAttribute('data-no-i18n','');
  document.querySelector('.properties').append(panel);
  const service=window.desktop?.polyhaven,tr=(es,en)=>getLanguage()==='en'?en:es;
  let entries=[],page=0,generation=0,loading=false,busy=false,selected=null;
  const thumbs=new Map();
  const make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
  function render(){
    generation++;panel.replaceChildren();
    panel.append(make('h3','Poly Haven · CC0'),make('p',tr('Modelos gratuitos. Solo se descarga el que añadas. Los nombres del catálogo se muestran en su idioma original.','Free models. Only the model you add is downloaded. Catalog names use their original language.')));
    const help=make('details'),summary=make('summary',tr('Uso en Arma 3','Using in Arma 3'));
    help.append(summary,make('p',tr('Empieza con texturas 1K. Revisa la escala, colisiones y sombras antes de exportar. Se conserva la textura base; algunos efectos PBR del visor no se reproducen en Arma. Añadir una silla no crea automáticamente una acción para sentarse.','Start with 1K textures. Check scale, collisions and shadows before exporting. The base texture is preserved; some viewport PBR effects are not reproduced in Arma. Adding a chair does not automatically create a sit action.')));panel.append(help);
    const form=make('form'),query=make('input');query.type='search';query.placeholder=tr('Buscar sillas, mesas… (chair, table)','Search chairs, tables…');query.setAttribute('aria-label',tr('Buscar modelos','Search models'));
    const search=make('button',tr('Buscar','Search'));form.append(query,search);panel.append(form);
    const info=make('p');info.id='polyhavenStatus';info.setAttribute('role','status');panel.append(info);
    const grid=make('div');grid.className='polyhaven-grid';panel.append(grid);
    const nav=make('div'),prev=make('button','‹'),next=make('button','›'),label=make('span');prev.type=next.type='button';prev.title=tr('Anterior','Previous');next.title=tr('Siguiente','Next');nav.append(prev,label,next);panel.append(nav);
    const detail=make('div');panel.append(detail);
    const aliases={silla:'chair',sillas:'chair',mesa:'table',mesas:'table',armario:'cabinet',armarios:'cabinet',madera:'wood',sofa:'sofa'};
    function filtered(){const q=query.value.trim().toLowerCase();const term=aliases[q]||q;return entries.filter(v=>[v.name,v.id,v.category,...v.tags].join(' ').toLowerCase().includes(term));}
    async function choose(item){
      if(busy)return;selected=item;detail.replaceChildren(make('h4',item.name));
      info.textContent=tr('Consultando tamaños…','Checking sizes…');
      try{
        const options=await service.details(item.id);if(selected!==item)return;
        detail.append(make('p',`${item.polycount?.toLocaleString()??'—'} ${tr('polígonos según catálogo','polygons reported by catalog')}`));
        const resolution=make('select');resolution.setAttribute('aria-label',tr('Resolución de texturas','Texture resolution'));
        for(const o of options)resolution.append(new Option(`${o.resolution} · ${(o.size/1048576).toFixed(1)} MB`,o.resolution));
        detail.append(resolution);
        if(!options.length){info.textContent=tr('Este modelo no ofrece glTF compatible.','This model has no compatible glTF.');return;}
        const add=make('button',tr('Añadir al proyecto','Add to project'));add.className='primary';detail.append(add);info.textContent='';
        add.onclick=async()=>{
          if(busy)return;busy=true;add.disabled=true;const original=api.root();
          info.textContent=tr('Descargando y preparando modelo…','Downloading and preparing model…');
          try{
            const payload=await service.download(item.id,resolution.value),model=await loadPolyHaven(payload);
            if(api.root()!==original)throw Error(tr('El proyecto cambió durante la descarga. Vuelve a añadir el modelo.','The project changed during download. Add the model again.'));
            api.add(model);info.textContent=tr('Añadido. Puedes moverlo, girarlo y deshacer con Ctrl+Z.','Added. You can move, rotate and undo with Ctrl+Z.');
          }catch(e){info.textContent=tr('No se pudo añadir: ','Could not add: ')+e.message;}finally{busy=false;add.disabled=false;}
        };
      }catch(e){info.textContent=tr('No se pudo consultar Poly Haven: ','Could not query Poly Haven: ')+e.message;}
    }
    function paint(){
      const token=++generation,all=filtered();page=Math.min(page,Math.max(0,Math.ceil(all.length/12)-1));grid.replaceChildren();
      prev.disabled=page===0;next.disabled=(page+1)*12>=all.length;label.textContent=` ${page+1} / ${Math.max(1,Math.ceil(all.length/12))} · ${all.length} `;
      const batch=all.slice(page*12,page*12+12);
      const jobs=batch.map(item=>{
        const b=make('button');b.type='button';b.className='polyhaven-card';const image=make('img');image.alt=item.name;
        b.append(image,make('span',item.name),make('small',`${item.polycount?.toLocaleString()??'—'} ${tr('polígonos','polygons')}`));b.onclick=()=>choose(item);grid.append(b);
        return async()=>{try{if(!thumbs.has(item.id))thumbs.set(item.id,await service.thumbnail(item.id));if(token===generation)image.src=thumbs.get(item.id);}catch{image.alt=tr('Vista previa no disponible','Preview unavailable');}};
      });
      // Two thumbnail requests at a time; stop work when the page changes.
      for(let worker=0;worker<2;worker++)void(async()=>{while(jobs.length&&token===generation)await jobs.shift()();})();
    }
    async function searchCatalog(){
      if(!service){info.textContent=tr('Disponible en la app de escritorio.','Available in the desktop app.');return;}
      if(loading)return;loading=true;search.disabled=true;info.textContent=tr('Cargando catálogo…','Loading catalog…');
      try{if(!entries.length)entries=await service.list();page=0;paint();info.textContent=entries.length?'':tr('Sin resultados.','No results.');}
      catch(e){info.textContent=tr('No se pudo conectar. Pulsa Buscar para reintentar. ','Could not connect. Press Search to retry. ')+e.message;}
      finally{loading=false;search.disabled=false;}
    }
    form.onsubmit=e=>{e.preventDefault();searchCatalog();};prev.onclick=()=>{page--;paint();};next.onclick=()=>{page++;paint();};
    if(entries.length)paint();else{prev.disabled=next.disabled=true;info.textContent=tr('Pulsa Buscar para consultar la biblioteca.','Press Search to browse the library.');}
  }
  render();onLanguage(()=>{if(!busy&&!loading)render();});
}
